// Profile avatar: pick an image, resize it in the browser to a small square
// data URL and store it in a hidden field (sent with the form). No upload
// endpoint or dependency needed.
const fileInput = document.getElementById('avatar-file');
const pickBtn = document.getElementById('avatar-pick');
const clearBtn = document.getElementById('avatar-clear');
const dataInput = document.getElementById('avatar-data');
const preview = document.getElementById('avatar-preview');

if (fileInput && pickBtn && dataInput && preview) {
  const MAX = 256; // longest edge in px

  function setPreview(url) {
    const avatar = preview.querySelector('.avatar');
    if (!avatar) return;
    if (url) {
      avatar.innerHTML = '';
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      avatar.appendChild(img);
    } else {
      avatar.innerHTML = `<span class="avatar-initial">${avatar.dataset.fallback || '?'}</span>`;
    }
  }

  pickBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        dataInput.value = dataUrl;
        setPreview(dataUrl);
        if (clearBtn) clearBtn.hidden = false;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      dataInput.value = '';
      fileInput.value = '';
      setPreview('');
      clearBtn.hidden = true;
    });
  }
}
