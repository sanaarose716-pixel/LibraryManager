
import { useEffect, useState } from "react";
import axios from "axios";
import {
  BookOpen, Plus, Search, RefreshCw, Pencil, Trash2,
  ArrowLeftRight, RotateCcw, History, LayoutDashboard,
  Library, X, ChevronLeft, ChevronRight, AlertCircle
} from "lucide-react";
import "./App.css";

const API = "http://localhost:5000/api";
const categories = ["Fiction", "Science", "History", "Technology", "Biography", "Other"];
const today = new Date().toLocaleDateString("en-CA");

const emptyBook = {
  title: "", author: "", isbn: "", category: "Fiction", totalCopies: 1
};

function App() {
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [available, setAvailable] = useState(false);
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(emptyBook);
  const [loanForm, setLoanForm] = useState({
    memberName: "", memberId: "", issueDate: today
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadBooks = async () => {
    try {
      const res = await axios.get(`${API}/books`, {
        params: { page, search, category, available }
      });
      setBooks(res.data.data.books);
      setTotalPages(Math.max(1, res.data.data.totalPages));
    } catch {
      setError("Unable to load books. Check the backend connection.");
    }
  };

  const loadStats = async () => {
    try {
      const res = await axios.get(`${API}/stats`);
      setStats(res.data.data);
    } catch {
      setError("Unable to load statistics.");
    }
  };

  const refresh = async () => {
    setLoading(true);
    await Promise.all([loadBooks(), loadStats()]);
    setLoading(false);
  };

  useEffect(() => {
    loadBooks();
  }, [page, search, category, available]);

  useEffect(() => {
    loadStats();
  }, []);

  const resetForm = () => {
    setForm(emptyBook);
    setError("");
    setSelected(null);
  };

  const openAdd = () => {
    resetForm();
    setModal("add");
  };

  const openEdit = (book) => {
    setSelected(book);
    setForm({
      title: book.title,
      author: book.author,
      totalCopies: book.totalCopies
    });
    setError("");
    setModal("edit");
  };

  const saveBook = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.title.trim() || !form.author.trim()) {
      setError("Title and Author are required.");
      return;
    }

    if (modal === "add") {
      if (!/^(?:\d{10}|\d{13})$/.test(form.isbn)) {
        setError("ISBN must contain exactly 10 or 13 digits.");
        return;
      }
      if (!Number.isInteger(Number(form.totalCopies)) ||
          form.totalCopies < 1 || form.totalCopies > 20) {
        setError("Total copies must be between 1 and 20.");
        return;
      }
    }

    try {
      if (modal === "add") {
        await axios.post(`${API}/books`, {
          ...form, totalCopies: Number(form.totalCopies)
        });
      } else {
        await axios.put(`${API}/books/${selected._id}`, {
          title: form.title,
          author: form.author,
          totalCopies: Number(form.totalCopies)
        });
      }
      setModal("");
      resetForm();
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save book.");
    }
  };

  const deleteBook = async (book) => {
    if (!window.confirm(`Delete "${book.title}" permanently?`)) return;
    try {
      await axios.delete(`${API}/books/${book._id}`);
      await refresh();
    } catch (err) {
      alert(err.response?.data?.message || "Unable to delete book.");
    }
  };

  const openIssue = (book) => {
    setSelected(book);
    setLoanForm({ memberName: "", memberId: "", issueDate: today });
    setError("");
    setModal("issue");
  };

  const issueBook = async (e) => {
    e.preventDefault();
    setError("");
    if (!loanForm.memberName.trim() || !loanForm.memberId.trim()) {
      setError("Enter Member Name and Member ID.");
      return;
    }
    if (loanForm.issueDate > today) {
      setError("Issue date cannot be in the future.");
      return;
    }
    try {
      await axios.post(`${API}/loans/issue`, {
        ...loanForm, bookId: selected._id
      });
      setModal("");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to issue book.");
    }
  };

  const returnBook = async (loan) => {
    if (!window.confirm("Confirm return of this book?")) return;
    try {
      await axios.put(`${API}/loans/return/${loan._id}`);
      await openHistory(selected);
      await refresh();
    } catch (err) {
      alert(err.response?.data?.message || "Unable to return book.");
    }
  };

  const openHistory = async (book) => {
    setSelected(book);
    setError("");
    try {
      const res = await axios.get(`${API}/books/${book._id}`);
      setHistory(res.data.data.loans);
      setModal("history");
    } catch {
      setError("Unable to load loan history.");
    }
  };

  const dateText = (date) =>
    date ? new Date(date).toLocaleDateString("en-IN") : "—";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Library size={25}/></div>
          <div><h2>Libra</h2><span>BOOK MANAGEMENT</span></div>
        </div>
        <div className="side-label">MENU</div>
        <div className="nav-active"><LayoutDashboard size={19}/> Dashboard</div>
        <div className="side-note">LIBRARY SYSTEM</div>
        <div className="sidebar-footer">
          <BookOpen size={17}/> Library Book Lending Manager
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">LIBRARY MANAGEMENT</span>
            <h1>Dashboard</h1>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={18}/> Add New Book
          </button>
        </header>

        <section className="welcome">
          <div>
            <span className="eyebrow light">YOUR LIBRARY AT A GLANCE</span>
            <h2>Welcome to your Library</h2>
            <p>Manage your collection, lending and returns in one place.</p>
          </div>
          <div className="welcome-icon"><BookOpen size={65}/></div>
        </section>

        <section className="stats-grid">
          <Stat icon={<BookOpen/>} label="Total Titles" value={stats.totalTitles ?? 0} color="blue"/>
          <Stat icon={<Library/>} label="Total Copies" value={stats.totalCopies ?? 0} color="purple"/>
          <Stat icon={<ArrowLeftRight/>} label="Currently Issued" value={stats.copiesIssued ?? 0} color="orange"/>
          <Stat icon={<AlertCircle/>} label="Overdue Loans" value={stats.overdueLoans ?? 0} color="red"/>
          <Stat icon={<RotateCcw/>} label="Fines Collected" value={`₹${stats.totalFineCollected ?? 0}`} color="green"/>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Book Collection</h2>
              <p>Manage and track your library books</p>
            </div>
            <button className="btn btn-outline" onClick={refresh}>
              <RefreshCw size={16} className={loading ? "spin" : ""}/> Refresh
            </button>
          </div>

          <div className="filters">
            <div className="search-box">
              <Search size={18}/>
              <input value={search} onChange={e => {setSearch(e.target.value);setPage(1);}}
                placeholder="Search title or author..."/>
            </div>
            <select value={category} onChange={e => {setCategory(e.target.value);setPage(1);}}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <label className="available-filter">
              <input type="checkbox" checked={available}
                onChange={e => {setAvailable(e.target.checked);setPage(1);}}/>
              Available only
            </label>
          </div>

          {error && !modal && <div className="error">{error}</div>}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>BOOK DETAILS</th><th>BOOK CODE</th><th>CATEGORY</th>
                  <th>AVAILABLE / TOTAL</th><th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {books.map(book => {
                  const issued = book.totalCopies - book.availableCopies;
                  return (
                    <tr key={book._id}>
                      <td>
                        <strong>{book.title}</strong>
                        <small>{book.author}</small>
                        <small>ISBN: {book.isbn}</small>
                      </td>
                      <td><span className="code">{book.bookCode}</span></td>
                      <td><span className="category-tag">{book.category}</span></td>
                      <td>
                        <strong className={book.availableCopies === 0 ? "zero" : "stock"}>
                          {book.availableCopies} / {book.totalCopies}
                        </strong>
                        <small>copies available</small>
                      </td>
                      <td>
                        <div className="actions">
                          <button title="Issue" disabled={book.availableCopies === 0}
                            onClick={() => openIssue(book)}><ArrowLeftRight size={16}/></button>
                          <button title="History" onClick={() => openHistory(book)}>
                            <History size={16}/>
                          </button>
                          <button title="Edit" onClick={() => openEdit(book)}>
                            <Pencil size={16}/>
                          </button>
                          <button title="Delete" disabled={issued > 0}
                            onClick={() => deleteBook(book)}><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {books.length === 0 && <tr><td colSpan="5" className="empty">
                  <BookOpen size={30}/><strong>No books found</strong>
                  <span>Add your first book to get started.</span>
                </td></tr>}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span>Page {page} of {totalPages}</span>
            <div>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={17}/> Previous
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight size={17}/>
              </button>
            </div>
          </div>
        </section>
        <footer>LIBRA · LIBRARY BOOK LENDING MANAGER</footer>
      </main>

      {modal && <div className="overlay" onMouseDown={e => {
        if (e.target === e.currentTarget) setModal("");
      }}>
        <div className={`modal ${modal === "history" ? "wide-modal" : ""}`}>
          <div className="modal-heading">
            <div>
              <span className="eyebrow">LIBRARY MANAGEMENT</span>
              <h2>
                {modal === "add" ? "Add New Book" :
                 modal === "edit" ? "Edit Book" :
                 modal === "issue" ? "Issue Book" : "Loan History"}
              </h2>
            </div>
            <button className="close-btn" onClick={() => setModal("")}><X/></button>
          </div>

          {modal === "add" || modal === "edit" ? (
            <form onSubmit={saveBook}>
              <label>Book Title<input required value={form.title}
                onChange={e => setForm({...form,title:e.target.value})}/></label>
              <label>Author<input required value={form.author}
                onChange={e => setForm({...form,author:e.target.value})}/></label>
              {modal === "add" && <>
                <label>ISBN (10 or 13 digits)<input required value={form.isbn}
                  maxLength={13} onChange={e => setForm({...form,isbn:e.target.value.replace(/\D/g,"")})}
                  placeholder="Enter ISBN"/></label>
                <label>Category<select value={form.category}
                  onChange={e => setForm({...form,category:e.target.value})}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select></label>
              </>}
              <label>Total Copies (1–20)<input type="number" min="1" max="20" required
                value={form.totalCopies}
                onChange={e => setForm({...form,totalCopies:Number(e.target.value)})}/></label>
              {error && <div className="error">{error}</div>}
              <button className="btn btn-primary full-btn">
                {modal === "add" ? "Add Book" : "Save Changes"}
              </button>
            </form>
          ) : modal === "issue" ? (
            <form onSubmit={issueBook}>
              <div className="selected-book"><BookOpen/>
                <div><strong>{selected?.title}</strong><small>{selected?.bookCode}</small></div>
              </div>
              <label>Member Name<input required value={loanForm.memberName}
                onChange={e => setLoanForm({...loanForm,memberName:e.target.value})}/></label>
              <label>Member ID<input required value={loanForm.memberId}
                onChange={e => setLoanForm({...loanForm,memberId:e.target.value})}/></label>
              <label>Issue Date<input type="date" required max={today}
                value={loanForm.issueDate}
                onChange={e => setLoanForm({...loanForm,issueDate:e.target.value})}/></label>
              <div className="info-note">Due date will be automatically set to 14 days after issue.</div>
              {error && <div className="error">{error}</div>}
              <button className="btn btn-primary full-btn">Confirm Issue</button>
            </form>
          ) : (
            <>
              <div className="history-book">
                <strong>{selected?.title}</strong>
                <span>{selected?.bookCode} · {selected?.author}</span>
              </div>
              <div className="table-wrap history-table">
                <table>
                  <thead><tr>
                    <th>MEMBER</th><th>ISSUED</th><th>DUE DATE</th>
                    <th>RETURNED</th><th>FINE</th><th>STATUS</th><th></th>
                  </tr></thead>
                  <tbody>
                    {history.map(loan => (
                      <tr key={loan._id}>
                        <td><strong>{loan.memberName}</strong><small>{loan.memberId}</small></td>
                        <td>{dateText(loan.issueDate)}</td>
                        <td>{dateText(loan.dueDate)}</td>
                        <td>{dateText(loan.returnDate)}</td>
                        <td>₹{loan.fine}</td>
                        <td><span className={`status ${loan.returnDate ? "returned" : "issued"}`}>
                          {loan.returnDate ? "Returned" : "Issued"}</span>
                          {loan.isOverdue && <span className="status overdue">Overdue</span>}
                        </td>
                        <td>{!loan.returnDate && <button className="btn btn-small"
                          onClick={() => returnBook(loan)}>Return</button>}</td>
                      </tr>
                    ))}
                    {history.length === 0 && <tr><td colSpan="7" className="empty">No loan history yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              <button className="btn btn-outline full-btn" onClick={() => setModal("")}>Close</button>
            </>
          )}
        </div>
      </div>}
    </div>
  );
}

function Stat({icon,label,value,color}) {
  return <div className="stat-card">
    <div className={`stat-icon ${color}`}>{icon}</div>
    <div><span>{label}</span><strong>{value}</strong></div>
  </div>;
}

export default App;
