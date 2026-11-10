import { send, bindForm } from "../common.js";

export default function authentication() {
  const login = document.querySelector("#login-form");
  if (login)
    bindForm(login, async (data) => {
      await send("/auth/login", data);
      const next = new URLSearchParams(location.search).get("next");
      location.href = ["/checkout.html", "/minha-conta.html", "/admin.html"].includes(next)
        ? next
        : "/minha-conta.html";
    });
  const register = document.querySelector("#register-form");
  if (register)
    bindForm(register, async (data) => {
      await send("/auth/register", data);
      location.href = "/minha-conta.html";
    });
}
