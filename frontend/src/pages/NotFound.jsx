import { Link } from 'react-router-dom';
import { EmptyState } from '../components/Feedback.jsx';

export default function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      text="The page you are looking for does not exist."
      action={<Link to="/dashboard" className="btn btn-primary">Back to dashboard</Link>}
    />
  );
}
