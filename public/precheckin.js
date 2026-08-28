function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

const uploadBox = document.getElementById('uploadBox');
const idFile = document.getElementById('idFile');
uploadBox.addEventListener('click', () => idFile.click());
idFile.addEventListener('change', () => {
  if (idFile.files.length) {
    uploadBox.textContent = `✓ ${idFile.files[0].name}`;
    uploadBox.classList.add('has-file');
  }
});

document.getElementById('checkinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  const payload = {
    bookingRef: document.getElementById('bookingRef').value,
    fullName: document.getElementById('fullName').value,
    phone: document.getElementById('phone').value,
    idType: document.getElementById('idType').value,
    idNumber: document.getElementById('idNumber').value,
    idFileName: idFile.files.length ? idFile.files[0].name : null
  };

  try {
    const res = await fetch('/api/precheckin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('failed');
    document.getElementById('checkinForm').style.display = 'none';
    document.getElementById('successPanel').style.display = 'block';
  } catch (err) {
    toast('Something went wrong. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit pre-check-in';
  }
});
