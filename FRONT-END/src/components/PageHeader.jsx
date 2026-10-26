export default function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}