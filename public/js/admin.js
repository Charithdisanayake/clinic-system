// Every fetch below relies on the server-side session cookie for auth.
// If a call comes back 401, the session has expired -- bounce to login.
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = '/admin/login';
    throw new Error('Not authenticated');
  }
  return res;
}

function money(cents) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

// ---------- Bootstrapping ----------
async function init() {
  const meRes = await api('/api/auth/me');
  const me = await meRes.json();
  document.getElementById('welcome').textContent = `Clinic Dashboard — ${me.fullName}`;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  });

  setupTabs();
  await Promise.all([loadClients(), loadTreatments(), loadDoctorsIntoSelect()]);
  await loadAppointments();

  document.getElementById('client-form').addEventListener('submit', onAddClient);
  document.getElementById('treatment-form').addEventListener('submit', onAddTreatment);
  document.getElementById('appt-form').addEventListener('submit', onAddAppointment);
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.panel).classList.add('active');
    });
  });
}

// ---------- Clients ----------
let clientCache = [];

async function loadClients() {
  const res = await api('/api/admin/clients');
  clientCache = await res.json();
  const tbody = document.getElementById('client-rows');
  tbody.innerHTML = clientCache.map((c) => `
    <tr>
      <td>${escapeHtml(c.full_name)}</td>
      <td>${escapeHtml(c.phone)}</td>
      <td>${escapeHtml(c.email)}</td>
      <td>${escapeHtml(c.notes)}</td>
    </tr>
  `).join('') || '<tr><td colspan="4">No clients yet.</td></tr>';

  const select = document.getElementById('appt-client');
  select.innerHTML = clientCache.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join('');
}

async function onAddClient(e) {
  e.preventDefault();
  const body = {
    full_name: document.getElementById('client-name').value,
    phone: document.getElementById('client-phone').value,
    email: document.getElementById('client-email').value,
    notes: document.getElementById('client-notes').value,
  };
  await api('/api/admin/clients', { method: 'POST', body: JSON.stringify(body) });
  e.target.reset();
  await loadClients();
}

// ---------- Treatments ----------
let treatmentCache = [];

async function loadTreatments() {
  const res = await api('/api/admin/treatments');
  treatmentCache = await res.json();
  const tbody = document.getElementById('treatment-rows');
  tbody.innerHTML = treatmentCache.map((t) => `
    <tr>
      <td>
        ${t.image_path ? `<img class="thumb" src="${escapeHtml(t.image_path)}" alt="${escapeHtml(t.name)}">` : '<span class="thumb-placeholder"></span>'}
        <label class="file-input-label">
          <input type="file" accept="image/jpeg,image/png,image/webp" data-image="${t.id}" hidden>
          ${t.image_path ? 'Replace' : 'Add photo'}
        </label>
      </td>
      <td>${escapeHtml(t.category)}</td>
      <td>${escapeHtml(t.name)}</td>
      <td>${money(t.price_cents)}</td>
      <td>${t.duration_minutes} min</td>
      <td>${t.active ? 'Yes' : 'No'}</td>
      <td><button class="btn-secondary" data-toggle="${t.id}">${t.active ? 'Hide' : 'Show'}</button></td>
    </tr>
  `).join('') || '<tr><td colspan="7">No treatments yet.</td></tr>';

  tbody.querySelectorAll('[data-image]').forEach((input) => {
    input.addEventListener('change', async () => {
      if (!input.files[0]) return;
      const formData = new FormData();
      formData.append('image', input.files[0]);
      await api(`/api/admin/treatments/${input.dataset.image}/image`, {
        method: 'POST',
        headers: {},
        body: formData,
      });
      await loadTreatments();
    });
  });

  tbody.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const t = treatmentCache.find((x) => x.id == btn.dataset.toggle);
      await api(`/api/admin/treatments/${t.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !t.active }),
      });
      await loadTreatments();
    });
  });

  const select = document.getElementById('appt-treatment');
  select.innerHTML = treatmentCache.map((t) => `<option value="${t.id}">${escapeHtml(t.name)} (${money(t.price_cents)})</option>`).join('');
}

async function onAddTreatment(e) {
  e.preventDefault();
  const body = {
    category: document.getElementById('t-category').value,
    name: document.getElementById('t-name').value,
    price_cents: Math.round(parseFloat(document.getElementById('t-price').value) * 100),
    duration_minutes: parseInt(document.getElementById('t-duration').value, 10),
  };
  await api('/api/admin/treatments', { method: 'POST', body: JSON.stringify(body) });
  e.target.reset();
  await loadTreatments();
}

// ---------- Doctors (for the appointment form dropdown) ----------
async function loadDoctorsIntoSelect() {
  const res = await api('/api/admin/doctors');
  const doctors = await res.json();
  const select = document.getElementById('appt-doctor');
  select.innerHTML = doctors.map((d) => `<option value="${d.id}">${escapeHtml(d.full_name)}</option>`).join('');
}

// ---------- Appointments ----------
async function loadAppointments() {
  const res = await api('/api/admin/appointments');
  const appts = await res.json();
  const tbody = document.getElementById('appt-rows');
  tbody.innerHTML = appts.map((a) => `
    <tr>
      <td>${new Date(a.starts_at).toLocaleString()}</td>
      <td>${escapeHtml(a.client_name)}</td>
      <td>${escapeHtml(a.treatment_name)}</td>
      <td>${escapeHtml(a.doctor_name)}</td>
      <td><span class="status-badge status-${a.status}">${a.status}</span></td>
      <td>${a.status === 'booked' ? `<button class="btn-danger" data-cancel="${a.id}">Cancel</button>` : ''}</td>
    </tr>
  `).join('') || '<tr><td colspan="6">No appointments yet.</td></tr>';

  tbody.querySelectorAll('[data-cancel]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/admin/appointments/${btn.dataset.cancel}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      await loadAppointments();
    });
  });
}

async function onAddAppointment(e) {
  e.preventDefault();
  const errorEl = document.getElementById('appt-error');
  errorEl.classList.add('hidden');

  const body = {
    client_id: document.getElementById('appt-client').value,
    doctor_id: document.getElementById('appt-doctor').value,
    treatment_id: document.getElementById('appt-treatment').value,
    starts_at: document.getElementById('appt-start').value,
    ends_at: document.getElementById('appt-end').value,
  };

  const res = await api('/api/admin/appointments', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json();
    errorEl.textContent = data.error || 'Could not create appointment.';
    errorEl.classList.remove('hidden');
    return;
  }
  e.target.reset();
  await loadAppointments();
}

init();
