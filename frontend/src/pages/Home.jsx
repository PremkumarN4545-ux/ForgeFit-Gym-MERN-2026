import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, ClipboardList, CreditCard, Dumbbell, ShieldCheck, Users } from 'lucide-react';

const FEATURES = [
  { icon: Users, title: 'Member management', copy: 'Keep member profiles, contact details and membership status organised in one place.' },
  { icon: ClipboardList, title: 'Flexible membership plans', copy: 'Create and maintain plans that make it easy to manage renewals and durations.' },
  { icon: CreditCard, title: 'Payment tracking', copy: 'Record payments and review payment history with clear, useful summaries.' },
  { icon: BarChart3, title: 'Business overview', copy: 'See key gym activity and revenue information at a glance.' },
];

export default function Home() {
  return (
    <main className="home-page">
      <header className="home-nav">
        <Link className="home-brand" to="/" aria-label="ForgeFit home">
          <span className="brand-mark"><Dumbbell size={21} /></span><span>ForgeFit</span>
        </Link>
        <nav className="home-nav-links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <Link className="home-signin-btn" to="/member-login">Sign In</Link>
          <Link className="home-create-account-btn" to="/register">Create Account</Link>
        </nav>
      </header>

      <section className="home-hero">
        <div className="home-hero-shade" />
        <div className="home-hero-content">
          <span className="eyebrow"><span /> GYM MANAGEMENT, MADE SIMPLE</span>
          <h1>Build a stronger gym.<br /><em>Run it smarter.</em></h1>
          <p>One organised workspace for your members, membership plans and payments. Spend less time managing records and more time growing your fitness community.</p>
          <div className="home-hero-actions">
            <Link to="/member-login" className="home-primary-btn">Sign in to your account <ArrowRight size={18} /></Link>
            <a href="#features" className="home-secondary-btn">Explore features</a>
          </div>
          <div className="home-trust"><ShieldCheck size={17} /> Secure member account access</div>
        </div>
        <div className="hero-side-note"><span>01 / 04</span><span>DISCIPLINE · PROGRESS · RESULTS</span></div>
      </section>

      <section className="home-features" id="features">
        <div className="home-section-heading">
          <span className="section-kicker">THE FORGEFIT TOOLKIT</span>
          <h2>Everything you need to stay on top of your gym.</h2>
          <p>Practical tools designed to keep daily gym administration clear and straightforward.</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, title, copy }, index) => (
            <article className="feature-card" key={title}>
              <div className="feature-top"><span className="feature-icon"><Icon size={21} /></span><span className="feature-number">0{index + 1}</span></div>
              <h3>{title}</h3><p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-cta" id="about">
        <div><span className="section-kicker">YOUR GYM. YOUR MOMENTUM.</span><h2>Make every day easier to manage.</h2><p>Sign in to your ForgeFit member account to view your membership details.</p></div>
        <Link to="/member-login" className="home-primary-btn">Member sign in <ArrowRight size={18} /></Link>
      </section>
      <footer className="home-footer"><Link className="home-brand" to="/"><span className="brand-mark"><Dumbbell size={18} /></span><span>ForgeFit</span></Link><span>© {new Date().getFullYear()} ForgeFit. Train hard. Manage smart.</span></footer>
    </main>
  );
}
