// Language switch (footer): store the choice in a cookie and reload so the
// server renders the page in the selected language. Default is English.
document.querySelectorAll('[data-lang-choice]').forEach((b) => {
  b.addEventListener('click', () => {
    const lang = b.dataset.langChoice;
    document.cookie = `epulonis-lang=${lang}; path=/; max-age=31536000; samesite=lax`;
    location.reload();
  });
});
