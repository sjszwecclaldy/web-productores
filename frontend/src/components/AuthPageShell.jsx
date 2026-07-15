export default function AuthPageShell({ children }) {
  return (
    <div className="auth-layout auth-layout--single">
      <div className="auth-panel auth-panel--form">
        <div className="auth-form-wrap">{children}</div>
      </div>
    </div>
  );
}
