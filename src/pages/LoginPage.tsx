import { getAllUsers } from "../services/lmsService";

interface Props {
  onLogin: (userId: string) => void;
}

export function LoginPage({ onLogin }: Props) {
  const users = getAllUsers();

  return (
    <div className="gate-screen">
      <h1>Saint Lucia School LMS</h1>
      <p>Use one of the seeded users to simulate email/password or OAuth login.</p>
      <div className="card">
        {users.map((user) => (
          <button key={user._id} onClick={() => onLogin(user._id)}>
            Sign in as {user.name}
          </button>
        ))}
      </div>
    </div>
  );
}
