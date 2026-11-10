// Aplica o tema salvo antes da primeira pintura, sem piscar a tela.
// Script clássico e síncrono no <head>; a troca de tema fica em theme.js.
{
  let mode = "auto";
  try {
    const saved = localStorage.getItem("vv_theme");
    if (saved === "light" || saved === "dark") mode = saved;
  } catch {
    // Sem armazenamento local, segue a preferência do sistema.
  }
  const dark =
    mode === "dark" ||
    (mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
