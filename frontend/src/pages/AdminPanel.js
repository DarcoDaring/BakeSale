import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  getUsers, createUser, updateUser, deleteUser,
  getInternalMasters, createInternalMaster, updateInternalMaster, deleteInternalMaster,
  getDirectMasters, createDirectMaster, updateDirectMaster,
} from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// User Modal
// ─────────────────────────────────────────────────────────────────────────────
function UserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    username: user?.username || '', password: '',
    role: user?.role || 'general', is_active: user?.is_active ?? true
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!user;

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.username) { toast.error('Username required'); return; }
    if (!isEdit && !form.password) { toast.error('Password required'); return; }
    setLoading(true);
    try {
      const payload = { username: form.username, role: form.role, is_active: form.is_active };
      if (form.password) payload.password = form.password;
      if (isEdit) { await updateUser(user.id, payload); toast.success('User updated'); }
      else        { await createUser(payload);          toast.success('User created'); }
      onSaved(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.username?.[0] || 'Failed to save user');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{isEdit ? '✏️ Edit User' : '👤 Create User'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input autoFocus value={form.username} onChange={e => set('username', e.target.value)} placeholder="Enter username" />
          </div>
          <div className="form-group">
            <label>{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
              placeholder={isEdit ? 'Leave blank to keep current' : 'Enter password'} />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="general">General User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {isEdit && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} style={{ width: 'auto' }} />
                Active User
              </label>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Saving…' : isEdit ? '✓ Update' : '✓ Create'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic Master Modal (used for both Internal Sale and Direct Sale masters)
// ─────────────────────────────────────────────────────────────────────────────
function MasterModal({ master, onClose, onSaved, title }) {
  const [name,     setName]     = useState(master?.name      || '');
  const [isActive, setIsActive] = useState(master?.is_active ?? true);
  const [loading,  setLoading]  = useState(false);
  const isEdit = !!master;

  const handleSubmit = async e => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name required'); return; }
    setLoading(true);
    try {
      if (isEdit) { await onSaved('update', master.id, { name, is_active: isActive }); }
      else        { await onSaved('create', null,       { name, is_active: isActive }); }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.name?.[0] || 'Failed to save');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <h2>{isEdit ? `✏️ Edit ${title}` : `➕ New ${title}`}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={`e.g. ${title} name…`} />
          </div>
          {isEdit && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} style={{ width: 'auto' }} />
                Active (visible in dropdown)
              </label>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Saving…' : isEdit ? '✓ Update' : '✓ Create'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User Master Section
// ─────────────────────────────────────────────────────────────────────────────
function UserMaster() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await getUsers();
    setUsers(data); setLoading(false);
  };
  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async u => {
    if (!window.confirm(`Delete user "${u.username}"?`)) return;
    try { await deleteUser(u.id); toast.success('User deleted'); fetchUsers(); }
    catch { toast.error('Failed to delete user'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>👥 User Master</h2>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>Manage user accounts and roles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ Create User</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div className="spinner" /> : (
          <table>
            <thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{u.username}</td>
                  <td><span className={`badge ${u.role === 'admin' ? 'badge-orange' : 'badge-blue'}`}>{u.role === 'admin' ? '👑 Admin' : '👤 General'}</span></td>
                  <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal(u)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && users.length === 0 && <div className="empty-state"><div className="icon">👥</div>No users found</div>}
      </div>
      {modal && <UserModal user={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={fetchUsers} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Sale Master Section
// ─────────────────────────────────────────────────────────────────────────────
function InternalSaleMasterSection() {
  const [masters,  setMasters]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);

  const fetchMasters = async () => {
    setLoading(true);
    const { data } = await getInternalMasters();
    setMasters(data); setLoading(false);
  };
  useEffect(() => { fetchMasters(); }, []);

  const handleSave = async (action, id, payload) => {
    if (action === 'create') { await createInternalMaster(payload); toast.success('Created'); }
    else                     { await updateInternalMaster(id, payload); toast.success('Updated'); }
    fetchMasters();
  };

  const handleDelete = async m => {
    if (!window.confirm(`Delete "${m.name}"?`)) return;
    try { await deleteInternalMaster(m.id); toast.success('Deleted'); fetchMasters(); }
    catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🏭 Internal Sale Master</h2>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>Manage internal destinations (e.g. Kitchen, Packaging)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ Add Destination</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div className="spinner" /> : (
          <table>
            <thead><tr><th>Name</th><th>Status</th><th>Created By</th><th>Actions</th></tr></thead>
            <tbody>
              {masters.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>🏭 {m.name}</td>
                  <td><span className={`badge ${m.is_active ? 'badge-green' : 'badge-red'}`}>{m.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ color: 'var(--text3)', fontSize: 13 }}>{m.created_by_username || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal(m)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && masters.length === 0 && <div className="empty-state"><div className="icon">🏭</div>No destinations yet</div>}
      </div>
      {modal && (
        <MasterModal
          master={modal === 'create' ? null : modal}
          title="Destination"
          onClose={() => setModal(null)}
          onSaved={handleSave}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct Sale Master Section
// ─────────────────────────────────────────────────────────────────────────────
function DirectSaleMasterSection() {
  const [masters,  setMasters]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);

  const fetchMasters = async () => {
    setLoading(true);
    const { data } = await getDirectMasters();
    setMasters(data); setLoading(false);
  };
  useEffect(() => { fetchMasters(); }, []);

  const handleSave = async (action, id, payload) => {
    if (action === 'create') { await createDirectMaster(payload); toast.success('Item created'); }
    else                     { await updateDirectMaster(id, payload); toast.success('Item updated'); }
    fetchMasters();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>⚡ Direct Sale Master</h2>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>Items available for direct sale (not in product catalogue)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ Add Item</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div className="spinner" /> : (
          <table>
            <thead><tr><th>Item Name</th><th>Status</th><th>Created By</th><th>Actions</th></tr></thead>
            <tbody>
              {masters.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600, color: m.is_active ? 'var(--text)' : 'var(--text3)' }}>⚡ {m.name}</td>
                  <td>
                    <span className={`badge ${m.is_active ? 'badge-green' : 'badge-red'}`}>
                      {m.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text3)', fontSize: 13 }}>{m.created_by_username || '—'}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setModal(m)}>✏️ Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && masters.length === 0 && (
          <div className="empty-state">
            <div className="icon">⚡</div>
            No direct sale items yet. Add items that you sell without stock tracking.
          </div>
        )}
      </div>
      {modal && (
        <MasterModal
          master={modal === 'create' ? null : modal}
          title="Direct Sale Item"
          onClose={() => setModal(null)}
          onSaved={handleSave}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Admin Panel
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [section, setSection] = useState('users');

  return (
    <div>
      <div className="page-header">
        <h1>⚙️ Admin Panel</h1>
      </div>

      {/* Section selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { k: 'users',    label: '👥 User Master',          desc: 'Manage users and roles' },
          { k: 'internal', label: '🏭 Internal Sale Master',  desc: 'Manage internal destinations' },
          { k: 'direct',   label: '⚡ Direct Sale Master',    desc: 'Manage direct sale items' },
        ].map(s => (
          <button key={s.k} onClick={() => setSection(s.k)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            padding: '16px 24px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
            background: section === s.k ? 'var(--accent-dim)' : 'var(--surface)',
            border: `1px solid ${section === s.k ? 'var(--accent)' : 'var(--border)'}`,
            minWidth: 200, transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: section === s.k ? 'var(--accent)' : 'var(--text)' }}>
              {s.label}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{s.desc}</span>
          </button>
        ))}
      </div>

      {section === 'users'    && <UserMaster />}
      {section === 'internal' && <InternalSaleMasterSection />}
      {section === 'direct'   && <DirectSaleMasterSection />}
    </div>
  );
}