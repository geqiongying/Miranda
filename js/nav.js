(() => {
  const nav = document.getElementById("siteNav");
  if (!nav) return;

  const toggle = nav.querySelector(".nav-toggle");
  const links = nav.querySelector(".nav-links");

  window.addEventListener("scroll", () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 20);
  });

  if (!toggle || !links) return;

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    document.body.classList.toggle("nav-lock", open);
  }

  toggle.addEventListener("click", () => {
    setOpen(!nav.classList.contains("is-open"));
  });

  links.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 880) setOpen(false);
  });
})();
