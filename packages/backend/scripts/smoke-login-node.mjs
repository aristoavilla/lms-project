const response = await fetch("http://127.0.0.1:8787/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@school.edu", password: "Password123!" }),
});

const text = await response.text();
console.log("STATUS", response.status);
console.log(text);

if (!response.ok) {
  process.exit(1);
}
