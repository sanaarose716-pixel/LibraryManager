
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Error:", err.message));

// BOOK MODEL
const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  isbn: { type: String, unique: true, required: true },
  category: { type: String, required: true },
  totalCopies: { type: Number, required: true, min: 1, max: 20 },
  availableCopies: { type: Number, required: true },
  bookCode: { type: String, unique: true }
}, { timestamps: true });

// LOAN MODEL
const loanSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
  memberName: String,
  memberId: String,
  issueDate: Date,
  dueDate: Date,
  returnDate: { type: Date, default: null },
  fine: { type: Number, default: 0 }
}, { timestamps: true });

// CATEGORY COUNTER
const counterSchema = new mongoose.Schema({
  category: { type: String, unique: true },
  sequence: { type: Number, default: 0 }
});

const Book = mongoose.model("Book", bookSchema);
const Loan = mongoose.model("Loan", loanSchema);
const Counter = mongoose.model("Counter", counterSchema);

const send = (res, status, success, message, data = null) => {
  res.status(status).json({ success, message, data });
};

// ADD BOOK
app.post("/api/books", async (req, res) => {
  try {
    const { title, author, isbn, category, totalCopies } = req.body;

    const categories = [
      "Fiction", "Science", "History",
      "Technology", "Biography", "Other"
    ];

    if (!title || !author ||
        !/^(?:\d{10}|\d{13})$/.test(isbn || "") ||
        !categories.includes(category) ||
        !Number.isInteger(totalCopies) ||
        totalCopies < 1 || totalCopies > 20) {
      return send(res, 400, false, "Invalid book details");
    }

    if (await Book.findOne({ isbn })) {
      return send(res, 409, false, "ISBN already exists");
    }

    const counter = await Counter.findOneAndUpdate(
      { category },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );

    const bookCode =
      `LB-${category.substring(0, 3).toUpperCase()}-${String(counter.sequence).padStart(3, "0")}`;

    const book = await Book.create({
      title, author, isbn, category,
      totalCopies,
      availableCopies: totalCopies,
      bookCode
    });

    send(res, 201, true, "Book added successfully", book);
  } catch (err) {
    if (err.code === 11000)
      return send(res, 409, false, "ISBN or Book Code already exists");
    send(res, 400, false, err.message);
  }
});

// VIEW BOOKS + SEARCH + FILTER + PAGINATION
app.get("/api/books", async (req, res) => {
  try {
    const { category, available, search = "", page = 1 } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (available === "true") filter.availableCopies = { $gt: 0 };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } }
      ];
    }

    const limit = 5;
    const currentPage = Math.max(1, Number(page) || 1);
    const total = await Book.countDocuments(filter);

    const books = await Book.find(filter)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);

    send(res, 200, true, "Books fetched", {
      books,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage
    });
  } catch (err) {
    send(res, 400, false, err.message);
  }
});

// BOOK DETAILS + LOAN HISTORY
app.get("/api/books/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return send(res, 404, false, "Book not found");

    const loans = await Loan.find({ bookId: book._id })
      .sort({ issueDate: -1 });

    const history = loans.map(loan => ({
      ...loan.toObject(),
      isOverdue: !loan.returnDate &&
        new Date() > loan.dueDate
    }));

    send(res, 200, true, "Book details fetched", {
      book,
      loans: history
    });
  } catch (err) {
    send(res, 400, false, err.message);
  }
});

// EDIT BOOK
app.put("/api/books/:id", async (req, res) => {
  try {
    const { title, author, totalCopies } = req.body;

    if (!title || !author ||
        !Number.isInteger(totalCopies) ||
        totalCopies < 1 || totalCopies > 20) {
      return send(res, 400, false, "Invalid details");
    }

    const book = await Book.findById(req.params.id);
    if (!book) return send(res, 404, false, "Book not found");

    const issued = book.totalCopies - book.availableCopies;

    if (totalCopies < issued)
      return send(res, 400, false, "Cannot reduce below issued copies");

    book.title = title;
    book.author = author;
    book.totalCopies = totalCopies;
    book.availableCopies = totalCopies - issued;

    await book.save();

    send(res, 200, true, "Book updated", book);
  } catch (err) {
    send(res, 400, false, err.message);
  }
});

// DELETE BOOK
app.delete("/api/books/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return send(res, 404, false, "Book not found");

    const active = await Loan.exists({
      bookId: book._id,
      returnDate: null
    });

    if (active)
      return send(res, 400, false, "Book has active loans");

    await Loan.deleteMany({ bookId: book._id });
    await book.deleteOne();

    send(res, 200, true, "Book deleted");
  } catch (err) {
    send(res, 400, false, err.message);
  }
});

// ISSUE BOOK
app.post("/api/loans/issue", async (req, res) => {
  try {
    const { bookId, memberName, memberId, issueDate } = req.body;

    const date = new Date(issueDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (!memberName || !memberId || !issueDate ||
        isNaN(date.getTime()) || date > today) {
      return send(res, 400, false, "Invalid issue details or future date");
    }

    const book = await Book.findById(bookId);
    if (!book) return send(res, 404, false, "Book not found");

    const existing = await Loan.exists({
      bookId, memberId, returnDate: null
    });

    if (existing)
      return send(res, 409, false, "Member already holds this book");

    const updated = await Book.findOneAndUpdate(
      { _id: bookId, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { new: true }
    );

    if (!updated)
      return send(res, 400, false, "No copies available");

    const dueDate = new Date(date);
    dueDate.setDate(dueDate.getDate() + 14);

    const loan = await Loan.create({
      bookId, memberName, memberId,
      issueDate: date, dueDate
    });

    send(res, 201, true, "Book issued successfully", loan);
  } catch (err) {
    send(res, 400, false, err.message);
  }
});

// RETURN BOOK
app.put("/api/loans/return/:id", async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);

    if (!loan) return send(res, 404, false, "Loan not found");

    if (loan.returnDate)
      return send(res, 409, false, "Already returned");

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(loan.dueDate);
    const dueDay = new Date(
      due.getFullYear(), due.getMonth(), due.getDate()
    );

    const daysLate = Math.max(
      0, Math.ceil((today - dueDay) / 86400000)
    );

    loan.returnDate = now;
    loan.fine = daysLate * 5;

    await loan.save();

    await Book.findByIdAndUpdate(
      loan.bookId,
      { $inc: { availableCopies: 1 } }
    );

    send(res, 200, true, "Book returned successfully", loan);
  } catch (err) {
    send(res, 400, false, err.message);
  }
});

// STATISTICS
app.get("/api/stats", async (req, res) => {
  try {
    const titles = await Book.countDocuments();

    const totals = await Book.aggregate([
      {
        $group: {
          _id: null,
          copies: { $sum: "$totalCopies" }
        }
      }
    ]);

    const issued = await Loan.countDocuments({ returnDate: null });

    const overdue = await Loan.countDocuments({
      returnDate: null,
      dueDate: { $lt: new Date() }
    });

    const fines = await Loan.aggregate([
      { $match: { returnDate: { $ne: null } } },
      {
        $group: {
          _id: null,
          total: { $sum: "$fine" }
        }
      }
    ]);

    send(res, 200, true, "Statistics fetched", {
      totalTitles: titles,
      totalCopies: totals[0]?.copies || 0,
      copiesIssued: issued,
      overdueLoans: overdue,
      totalFineCollected: fines[0]?.total || 0
    });
  } catch (err) {
    send(res, 400, false, err.message);
  }
});

// START SERVER
app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
