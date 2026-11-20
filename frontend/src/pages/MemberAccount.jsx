import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  Dumbbell,
  LogOut,
  QrCode,
  ReceiptText,
  Smartphone,
  Sun,
  Moon,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { EmptyState, PageLoader, StatusBadge } from '../components/Feedback.jsx';
import * as memberService from '../services/memberService';
import * as planService from '../services/planService';
import { getErrorMessage } from '../services/api';
import { durationLabel, formatCurrency, formatDate, paymentDetailRows, paymentDetailsSummary, PHONE_RE } from '../utils/format';
import Modal from '../components/Modal.jsx';
import { downloadMembershipReceipt } from '../utils/receiptPdf';

const PAYMENT_OPTIONS = [
  { id: 'Google Pay', label: 'Google Pay', Icon: Wallet },
  { id: 'PhonePe', label: 'PhonePe', Icon: Smartphone },
  { id: 'UPI', label: 'UPI Payment', Icon: CreditCard },
  { id: 'QR Code', label: 'QR Code Payment', Icon: QrCode },
];

let razorpayScriptPromise;

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        if (window.Razorpay) resolve(window.Razorpay);
        else {
          razorpayScriptPromise = null;
          reject(new Error('Razorpay Checkout could not be initialized. Please try again.'));
        }
      };
      script.onerror = () => {
        razorpayScriptPromise = null;
        reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
      };
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

const DASHBOARD_NAV = [
  { id: 'dashboard', label: 'Dashboard', Icon: Activity },
  { id: 'gym-features', label: 'Gym Features', Icon: Dumbbell },
  { id: 'membership-details', label: 'Membership Details', Icon: CalendarDays },
  { id: 'available-plans', label: 'Available Membership Plans', Icon: Check },
  { id: 'payment-details', label: 'Payment Details', Icon: CreditCard },
  { id: 'payment-history', label: 'Payment History', Icon: ReceiptText },
  { id: 'profile', label: 'My Profile', Icon: UserRound },
];

function SectionTitle({ kicker, title, description }) {
  return (
    <div className="member-dashboard-section-title">
      <span className="section-kicker">{kicker}</span>
      <h2>{title}</h2>
      {description && <p className="muted">{description}</p>}
    </div>
  );
}

function Detail({ label, children }) {
  return <div className="member-dashboard-detail"><dt>{label}</dt><dd>{children}</dd></div>;
}

function memberPaymentMethod(payment) {
  const preference = /^Paid online via (Google Pay|PhonePe|UPI|QR Code)$/.exec(payment?.notes || '')?.[1];
  return preference || payment?.method || '—';
}

function formatReceiptDateTime(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function InlineError({ message, onRetry }) {
  return (
    <div className="member-dashboard-error" role="alert">
      <p>{message}</p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>Retry</button>
    </div>
  );
}

export default function MemberAccount() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [plans, setPlans] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [plansError, setPlansError] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payMethod, setPayMethod] = useState('Google Pay');
  const [paySaving, setPaySaving] = useState(false);
  const [payResult, setPayResult] = useState(null);
  const [payFormError, setPayFormError] = useState('');
  const [paymentProof, setPaymentProof] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSeconds, setQrSeconds] = useState(15);
  const [qrRunId, setQrRunId] = useState(0);
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [receiptDownloadError, setReceiptDownloadError] = useState('');
  const [receiptDownloading, setReceiptDownloading] = useState(false);
  const [receiptActionMessage, setReceiptActionMessage] = useState('');

  const closeQrPopup = useCallback(() => {
    setQrOpen(false);
    setQrSeconds(15);
  }, []);

  const selectPaymentMethod = (id) => {
    setPayMethod(id);
    setPayFormError('');
    if (id === 'QR Code') {
      setQrSeconds(15);
      setQrRunId((runId) => runId + 1);
      setQrOpen(true);
    }
  };

  useEffect(() => {
    if (!qrOpen) return undefined;
    const deadline = Date.now() + 15000;
    const interval = window.setInterval(() => {
      setQrSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 1000);
    const timeout = window.setTimeout(() => {
      setQrSeconds(0);
      setQrOpen(false);
    }, 15000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [qrOpen, qrRunId]);

  useEffect(() => {
    let ignore = false;
    setDashboardLoading(true);
    setPlansLoading(true);
    setDashboardError('');
    setPlansError('');

    memberService.getMyDashboard()
      .then((data) => !ignore && setDashboard(data))
      .catch((error) => !ignore && setDashboardError(getErrorMessage(error)))
      .finally(() => !ignore && setDashboardLoading(false));

    planService.listAvailablePlans()
      .then((data) => !ignore && setPlans(data))
      .catch((error) => !ignore && setPlansError(getErrorMessage(error)))
      .finally(() => !ignore && setPlansLoading(false));

    return () => { ignore = true; };
  }, [reloadKey]);

  const profile = dashboard?.profile;
  const membership = dashboard?.membership;
  const payments = dashboard?.payments || [];
  const latestPayment = payments[0];
  const outstandingBalance = dashboard?.paymentSummary?.outstandingBalance || 0;
  const displayName = profile?.fullName || user?.fullName || user?.name || 'Member';
  useEffect(() => {
    if (!checkoutPhone && profile?.phone) setCheckoutPhone(profile.phone);
  }, [checkoutPhone, profile?.phone]);
  const publishedBenefits = useMemo(
    () => [...new Set((plans || []).flatMap((plan) => plan.benefits || []))],
    [plans]
  );
  const trainingBenefits = publishedBenefits.filter((benefit) => /trainer|personal training|coaching/i.test(benefit));
  const selectedPlan = plans?.find((plan) => plan._id === selectedPlanId);
  const checkoutPlan = selectedPlan || (payResult ? {
    name: payResult.planName,
    price: payResult.amount,
    durationMonths: payResult.durationMonths || payResult.plan?.durationMonths,
  } : null);

  const selectPlan = (planId) => {
    setSelectedPlanId((current) => current === planId ? '' : planId);
    setCheckoutOpen(false);
    setPayResult(null);
    setPayFormError('');
    setPaymentProof(null);
    closeQrPopup();
  };

  const continueToPayment = () => {
    if (!selectedPlan) return;
    setCheckoutOpen(true);
    setPayFormError('');
  };

  const generateReceipt = (payment) => {
    setReceiptActionMessage('');
    setReceiptPayment({
      ...payment,
      receiptNumber: payment.receiptNumber || payment.paymentId,
      receiptDate: payment.receiptDate || payment.createdAt || new Date().toISOString(),
      durationMonths: payment.durationMonths || payment.planDurationMonths || payment.plan?.durationMonths,
      preferredMethod: memberPaymentMethod(payment),
      memberName: payment.memberName || profile?.fullName || displayName,
      memberEmail: payment.memberEmail || profile?.email || user?.email,
      memberPhone: payment.memberPhone || profile?.phone,
      membershipStartDate: payment.membershipStartDate
        || (membership?.plan?.name === payment.planName ? membership.startDate : undefined),
      membershipExpiryDate: payment.membershipExpiryDate
        || (membership?.plan?.name === payment.planName ? membership.expiryDate : undefined),
    });
    setReceiptDownloadError('');
  };

  const generateLatestReceipt = () => {
    if (!latestPayment) {
      setReceiptActionMessage('No payment record found. Please complete your membership payment to generate a receipt.');
      return;
    }
    generateReceipt(latestPayment);
  };

  const downloadReceipt = async () => {
    if (!receiptPayment) return;
    setReceiptDownloading(true);
    try {
      await downloadMembershipReceipt(receiptPayment);
    } catch (error) {
      setReceiptDownloadError(error.message);
    } finally {
      setReceiptDownloading(false);
    }
  };

  const verifyPayment = async (proof) => {
    setPaySaving(true);
    setPayFormError('');
    try {
      const saved = await memberService.verifyMembershipPayment(proof);
      if (saved.status !== 'Paid' || !saved.receiptNumber) {
        throw new Error('The server has not confirmed this payment. No receipt was generated.');
      }
      setPayResult(saved);
      setPaymentProof(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setPaymentProof(proof);
      setPayFormError(`Payment verification is not complete: ${getErrorMessage(error)}`);
    } finally {
      setPaySaving(false);
    }
  };

  const submitPayment = async () => {
    if (paymentProof) {
      await verifyPayment(paymentProof);
      return;
    }
    if (!selectedPlan) return;
    const normalizedPhone = checkoutPhone.trim();
    const phoneDigits = normalizedPhone.replace(/\D/g, '');
    if (!PHONE_RE.test(normalizedPhone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
      setPayFormError('Enter a valid phone number to continue.');
      return;
    }
    setPayFormError('');
    setPayResult(null);
    setPaySaving(true);
    try {
      const order = await memberService.createMembershipOrder({
        plan: selectedPlan?._id,
        method: payMethod,
        phone: normalizedPhone,
      });
      const Razorpay = await loadRazorpayCheckout();
      if (!Razorpay) throw new Error('Razorpay Checkout could not be initialized. Please try again.');

      await new Promise((resolve) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          setPaySaving(false);
          resolve();
        };
        const checkout = new Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'ForgeFit',
          description: `${order.plan.name} membership`,
          order_id: order.orderId,
          prefill: {
            name: displayName,
            email: profile?.email || user?.email,
          },
          method: { upi: true, card: false, netbanking: false, wallet: false },
          upi: { flow: payMethod === 'QR Code' ? 'qr' : 'intent' },
          theme: { color: '#0f2557' },
          handler: async (response) => {
            await verifyPayment(response);
            finish();
          },
          modal: {
            ondismiss: () => {
              if (!finished) setPayFormError('Payment was cancelled. Your membership has not been changed; you can try again.');
              finish();
            },
          },
        });
        checkout.on('payment.failed', (response) => {
          setPayFormError(response.error?.description || 'Payment failed. Your membership has not been changed; please retry.');
          finish();
        });
        checkout.open();
      });
    } catch (error) {
      setPayFormError(getErrorMessage(error));
      setPaySaving(false);
    }
  };

  const retry = () => setReloadKey((key) => key + 1);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <main className="member-account-page">
      <header className="member-account-nav">
        <Link className="home-brand" to="/" aria-label="ForgeFit home">
          <span className="brand-mark"><Dumbbell size={21} /></span><span>ForgeFit</span>
        </Link>
        <span className="member-dashboard-header-label">Member Dashboard</span>
      </header>

      <div className="member-dashboard-layout">
        <aside className="member-dashboard-sidebar">
          <span className="member-dashboard-nav-label">YOUR ACCOUNT</span>
          <nav className="member-dashboard-nav" aria-label="User dashboard navigation">
            {DASHBOARD_NAV.map(({ id, label, Icon }) => (
              <a className="member-dashboard-nav-link" href={`#${id}`} key={id}>
                <Icon size={17} /> <span>{label}</span>
              </a>
            ))}
            <button type="button" className="member-dashboard-nav-link member-dashboard-logout" onClick={handleLogout}>
              <LogOut size={17} /> <span>Logout</span>
            </button>
          </nav>
          <p className="member-dashboard-private-note">Your account shows information associated with your signed-in membership.</p>
        </aside>

        <div className="member-dashboard-main">
          <section className="member-dashboard-card" id="dashboard">
            <div className="member-dashboard-welcome">
              <div>
                <span className="section-kicker">MEMBER DASHBOARD</span>
                <h1>Welcome, {displayName}</h1>
                <p className="muted">Your membership and payment information, all in one place.</p>
              </div>
              {membership?.status && <StatusBadge status={membership.status} />}
            </div>
            {dashboardError && <InlineError message={dashboardError} onRetry={retry} />}
            {dashboardLoading ? (
              <PageLoader label="Loading your account..." />
            ) : (
              <div className="member-dashboard-stat-grid">
                <article className="member-dashboard-stat">
                  <span>Membership plan</span>
                  <strong>{membership?.plan?.name || 'No membership assigned'}</strong>
                </article>
                <article className="member-dashboard-stat">
                  <span>Membership status</span>
                  <strong>{membership?.status || 'Not enrolled'}</strong>
                </article>
                <article className="member-dashboard-stat">
                  <span>Latest payment</span>
                  <strong>{latestPayment ? formatCurrency(latestPayment.amount) : 'No payment recorded'}</strong>
                </article>
                <article className="member-dashboard-stat">
                  <span>Outstanding balance</span>
                  <strong>{formatCurrency(outstandingBalance)}</strong>
                </article>
              </div>
            )}
          </section>

          <section className="member-dashboard-card" id="gym-features">
            <SectionTitle
              kicker="GYM INFORMATION"
              title="Gym Features"
              description="Details below are taken from the gym's existing active plan records."
            />
            {plansError && <InlineError message={plansError} onRetry={retry} />}
            {plansLoading ? (
              <PageLoader label="Loading gym information..." />
            ) : (
              <>
                <div className="member-dashboard-info-grid">
                  <article className="member-dashboard-info-tile member-dashboard-info-featured">
                    <Dumbbell size={20} />
                    <h3>Published features and services</h3>
                    {publishedBenefits.length ? (
                      <ul className="member-dashboard-benefit-list">
                        {publishedBenefits.map((benefit) => <li key={benefit}><Check size={15} />{benefit}</li>)}
                      </ul>
                    ) : (
                      <p className="muted">No feature or service benefits are currently listed in active plans.</p>
                    )}
                  </article>
                  <article className="member-dashboard-info-tile">
                    <Activity size={20} />
                    <h3>Fitness programmes &amp; workout plans</h3>
                    <p className="muted">Programme and workout-plan details are not recorded in the current gym information.</p>
                  </article>
                  <article className="member-dashboard-info-tile">
                    <UserRound size={20} />
                    <h3>Personal training &amp; trainers</h3>
                    {trainingBenefits.length ? (
                      <ul className="member-dashboard-benefit-list">
                        {trainingBenefits.map((benefit) => <li key={benefit}><Check size={15} />{benefit}</li>)}
                      </ul>
                    ) : (
                      <p className="muted">No personal-training or trainer details are currently listed.</p>
                    )}
                  </article>
                  <article className="member-dashboard-info-tile">
                    <Clock3 size={20} />
                    <h3>Gym timings</h3>
                    <p className="muted">Gym Opening Hours</p>
                    <ul className="member-dashboard-benefit-list">
                      <li>
                        <Sun size={16} aria-hidden="true" />
                        <span><strong>Morning Session</strong><br /><strong>6:00 AM – 11:00 AM</strong></span>
                      </li>
                      <li>
                        <Moon size={16} aria-hidden="true" />
                        <span><strong>Evening Session</strong><br /><strong>4:00 PM – 11:00 PM</strong></span>
                      </li>
                    </ul>
                  </article>
                </div>
              </>
            )}
          </section>

          <section className="member-dashboard-card" id="membership-details">
            <SectionTitle
              kicker="YOUR MEMBERSHIP"
              title="Membership Details"
              description="Your active plan, dates, status, and benefits."
            />
            {dashboardLoading ? (
              <PageLoader label="Loading membership details..." />
            ) : membership ? (
              <div className="member-dashboard-membership-grid">
                <dl className="member-dashboard-details">
                  <Detail label="Membership plan">{membership.plan?.name || 'Plan details unavailable'}</Detail>
                  <Detail label="Membership type">{membership.plan?.name || 'Not assigned'}</Detail>
                  <Detail label="Start date">{formatDate(membership.startDate)}</Detail>
                  <Detail label="Expiry date">{formatDate(membership.expiryDate)}</Detail>
                  <Detail label="Duration">{durationLabel(membership.plan?.durationMonths)}</Detail>
                  <Detail label="Membership price">{membership.plan ? formatCurrency(membership.plan.price) : '—'}</Detail>
                  <Detail label="Status"><StatusBadge status={membership.status} /></Detail>
                </dl>
                <div className="member-dashboard-membership-benefits">
                  <h3>Membership benefits</h3>
                  {membership.plan?.benefits?.length ? (
                    <ul className="member-dashboard-benefit-list">
                      {membership.plan.benefits.map((benefit) => <li key={benefit}><Check size={15} />{benefit}</li>)}
                    </ul>
                  ) : (
                    <p className="muted">No benefits are listed for this plan.</p>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No membership assigned yet"
                text="You have not purchased a membership yet. Choose an active plan below to get started."
                action={<a className="btn btn-primary" href="#available-plans">View available plans</a>}
              />
            )}
          </section>

          <section className="member-dashboard-card" id="available-plans">
            <SectionTitle
              kicker="ACTIVE PLANS"
              title="Available Membership Plans"
              description="Choose one active plan, change it or select it again to clear your choice, then continue to checkout."
            />
            {plansError && <InlineError message={plansError} onRetry={retry} />}
            {plansLoading ? (
              <PageLoader label="Loading available plans..." />
            ) : plans?.length ? (
              <>
                <div className="member-dashboard-plan-grid">
                  {plans.map((plan) => (
                    <article
                      className={`member-dashboard-plan${selectedPlanId === plan._id ? ' is-selected' : ''}`}
                      key={plan._id}
                    >
                      <div className="member-dashboard-plan-heading">
                        <h3>{plan.name}</h3>
                        {selectedPlanId === plan._id && <span className="member-plan-selected-label"><Check size={14} /> Selected</span>}
                      </div>
                      <p className="member-dashboard-plan-price">
                        {formatCurrency(plan.price)} <span>/ {durationLabel(plan.durationMonths)}</span>
                      </p>
                      {plan.description && <p className="muted">{plan.description}</p>}
                      {plan.benefits?.length > 0 && (
                        <ul className="member-dashboard-benefit-list">
                          {plan.benefits.map((benefit) => <li key={benefit}><Check size={15} />{benefit}</li>)}
                        </ul>
                      )}
                      <button
                        type="button"
                        className={`btn ${selectedPlanId === plan._id ? 'btn-secondary' : 'btn-primary'} member-plan-select`}
                        aria-pressed={selectedPlanId === plan._id}
                        disabled={paySaving}
                        onClick={() => selectPlan(plan._id)}
                      >
                        {selectedPlanId === plan._id ? 'Unselect Plan' : 'Select Plan'}
                      </button>
                    </article>
                  ))}
                </div>
                <div className="member-plan-selection-summary">
                  <div>
                    <span className="section-kicker">SELECTED MEMBERSHIP</span>
                    {selectedPlan ? (
                      <>
                        <strong>{selectedPlan.name}</strong>
                        <span>{durationLabel(selectedPlan.durationMonths)} · {formatCurrency(selectedPlan.price)}</span>
                      </>
                    ) : <span className="muted">Select a plan to continue.</span>}
                  </div>
                  <button type="button" className="btn btn-primary" disabled={!selectedPlan || paySaving} onClick={continueToPayment}>
                    Continue to Payment
                  </button>
                </div>
                {checkoutOpen && checkoutPlan && (
                  <div className="member-plan-checkout">
                    <div className="member-plan-checkout-heading">
                      <div>
                        <span className="section-kicker">SECURE CHECKOUT</span>
                        <h3>Payment options</h3>
                      </div>
                      <span className="member-plan-gateway">Powered by Razorpay</span>
                    </div>
                    <p className="muted member-plan-payment-hint">Choose a UPI option. Google Pay, PhonePe, UPI apps, and QR payment are handled securely by Razorpay.</p>
                    <div className="member-payment-options" role="group" aria-label="Choose a payment method">
                      {PAYMENT_OPTIONS.map(({ id, label, Icon }) => (
                        <button
                          type="button"
                          className={`member-payment-option${payMethod === id ? ' is-selected' : ''}`}
                          aria-pressed={payMethod === id}
                          key={id}
                          disabled={paySaving || Boolean(payResult)}
                          onClick={() => selectPaymentMethod(id)}
                        >
                          <Icon size={20} aria-hidden="true" />
                          <span>{label}</span>
                          {payMethod === id && <Check size={16} aria-hidden="true" />}
                        </button>
                      ))}
                    </div>
                    <div className="member-payment-summary">
                      <span>Selected plan</span>
                      <strong>{checkoutPlan.name} · {durationLabel(checkoutPlan.durationMonths)}</strong>
                      <span>Total amount</span>
                      <strong>{formatCurrency(checkoutPlan.price)}</strong>
                      <span>Payment method</span>
                      <strong>{PAYMENT_OPTIONS.find((option) => option.id === payMethod)?.label}</strong>
                    </div>
                    <div className="field member-checkout-phone">
                      <label htmlFor="member-checkout-phone">Member phone number *</label>
                      <input
                        id="member-checkout-phone"
                        type="tel"
                        autoComplete="tel"
                        maxLength={20}
                        value={checkoutPhone}
                        onChange={(event) => {
                          setCheckoutPhone(event.target.value);
                          setPayFormError('');
                        }}
                        placeholder="e.g. +91 98765 43210"
                        disabled={paySaving || Boolean(payResult)}
                      />
                    </div>
                    {payFormError && <p className="member-payment-error" role="alert">{payFormError}</p>}
                    {payResult && (
                      <div className="member-payment-success" role="status">
                        <h3><Check size={19} /> Payment Successful</h3>
                        <dl>
                          <Detail label="Membership plan">{payResult.planName}</Detail>
                          <Detail label="Amount paid">{formatCurrency(payResult.amount)}</Detail>
                          <Detail label="Transaction ID">{payResult.transactionId || payResult.paymentId}</Detail>
                          <Detail label="Payment date">{formatDate(payResult.paymentDate)}</Detail>
                          <Detail label="Payment method">{payResult.preferredMethod || payResult.method}</Detail>
                          <Detail label="Membership duration">{durationLabel(payResult.durationMonths)}</Detail>
                          <Detail label="Membership start date">{formatDate(payResult.membershipStartDate)}</Detail>
                          <Detail label="Membership expiry date">{formatDate(payResult.membershipExpiryDate)}</Detail>
                          <Detail label="Receipt number">{payResult.receiptNumber}</Detail>
                        </dl>
                        <p>Your membership details have been updated.</p>
                        {payResult.status === 'Paid' && payResult.receiptNumber && (
                          <button type="button" className="btn btn-primary member-receipt-download" onClick={() => generateReceipt(payResult)}>
                            GENERATE RECEIPT
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary member-pay-now"
                      disabled={paySaving || Boolean(payResult)}
                      onClick={submitPayment}
                    >
                      {paySaving ? 'Processing securely...' : paymentProof ? 'Retry payment verification' : payResult ? 'Payment complete' : `Pay Now · ${formatCurrency(checkoutPlan.price)}`}
                    </button>
                    <p className="member-dashboard-note">Payment is confirmed only after Razorpay verifies it with ForgeFit’s server. Cancelled or failed payments do not activate a membership.</p>
                  </div>
                )}
              </>
            ) : (
              <EmptyState icon={CalendarDays} title="No active plans available" text="There are no active membership plans to display right now." />
            )}
          </section>

          <section className="member-dashboard-card" id="payment-details">
            <SectionTitle
              kicker="YOUR PAYMENTS"
              title="Payment Details"
              description="Payment information associated with your account."
            />
            {dashboardLoading ? (
              <PageLoader label="Loading payment details..." />
            ) : latestPayment ? (
              <div className="member-dashboard-payment-grid">
                <div className="member-dashboard-payment-highlight">
                  <span>Most recent recorded payment</span>
                  <strong>{formatCurrency(latestPayment.amount)}</strong>
                  <StatusBadge status={latestPayment.status} />
                </div>
                <dl className="member-dashboard-details">
                  <Detail label="Payment date">{formatDate(latestPayment.paymentDate)}</Detail>
                  <Detail label="Payment method">{memberPaymentMethod(latestPayment)}</Detail>
                  {paymentDetailRows(latestPayment).filter(([, v]) => v).map(([label, v]) => <Detail key={label} label={label}>{v}</Detail>)}
                  <Detail label="Transaction ID">{latestPayment.transactionRef || 'Not provided'}</Detail>
                  <Detail label="Plan">{latestPayment.planName || '—'}</Detail>
                  <Detail label="Outstanding balance">{formatCurrency(outstandingBalance)}</Detail>
                  <Detail label="Total paid">{formatCurrency(dashboard?.paymentSummary?.totalPaid || 0)}</Detail>
                </dl>
              </div>
            ) : (
              <EmptyState icon={Wallet} title="No payment records yet" text="Payment details will appear here after a payment is verified or recorded for your account." />
            )}
            <div className="member-receipt-action">
              <button type="button" className="btn btn-primary" onClick={generateLatestReceipt} disabled={dashboardLoading}>
                <ReceiptText size={17} aria-hidden="true" /> GENERATE RECEIPT
              </button>
              {receiptActionMessage && <p className="member-payment-error" role="alert">{receiptActionMessage}</p>}
            </div>
          </section>

          <section className="member-dashboard-card" id="payment-history">
            <SectionTitle
              kicker="TRANSACTION RECORDS"
              title="Payment History"
              description="Your payment records, newest first. Generate a receipt to view each record's current payment status."
            />
            {dashboardLoading ? (
              <PageLoader label="Loading payment history..." />
            ) : payments.length ? (
              <div className="member-dashboard-table-wrap">
                <table className="member-dashboard-table">
                  <thead>
                    <tr>
                      <th>Payment</th><th>Date</th><th>Amount</th><th>Method</th><th>Transaction ID</th><th>Status</th><th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment._id}>
                        <td>{payment.paymentId || '—'}</td>
                        <td>{formatDate(payment.paymentDate)}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>{memberPaymentMethod(payment)}{paymentDetailsSummary(payment) && <div className="muted small">{paymentDetailsSummary(payment)}</div>}</td>
                        <td>{payment.transactionRef || '—'}</td>
                        <td><StatusBadge status={payment.status} /></td>
                        <td>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => generateReceipt(payment)}>
                            <ReceiptText size={15} aria-hidden="true" /> GENERATE RECEIPT
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={ReceiptText} title="No payment history" text="No payment record is available yet, so a receipt cannot be generated." />
            )}
          </section>

          <section className="member-dashboard-card" id="profile">
            <SectionTitle kicker="ACCOUNT" title="My Profile" description="Profile details for the account currently signed in." />
            {dashboardLoading ? (
              <PageLoader label="Loading your profile..." />
            ) : (
              <dl className="member-dashboard-details member-dashboard-profile">
                <Detail label="Full name">{profile?.fullName || user?.fullName || user?.name || '—'}</Detail>
                <Detail label="Email address">{profile?.email || user?.email || '—'}</Detail>
                <Detail label="Member ID">{profile?.memberId || 'No membership linked'}</Detail>
              </dl>
            )}
          </section>
        </div>
      </div>
      {qrOpen && (
        <Modal title="Scan to pay" onClose={closeQrPopup}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <img
              src="/dummy-gym-membership-qr.png"
              alt="Dummy gym membership payment QR code"
              style={{ display: 'block', maxWidth: '100%', maxHeight: '55vh', width: 'auto', height: 'auto', objectFit: 'contain' }}
            />
            <p className="muted">Demo QR code only. Scanning it does not verify or confirm a payment.</p>
            <p aria-live="polite">QR closes in <strong>{qrSeconds}</strong> seconds.</p>
          </div>
        </Modal>
      )}
      {receiptPayment && (
        <Modal title="ForgeFit receipt" onClose={() => setReceiptPayment(null)}>
          <div className="member-receipt-preview">
            <div className="member-receipt-brand">
              <span className="brand-mark"><Dumbbell size={19} /></span>
              <div><strong>ForgeFit Gym</strong><span>PAYMENT RECEIPT</span></div>
              <span className="member-receipt-number">{receiptPayment.receiptNumber}</span>
            </div>
            <dl className="detail-list">
              {[
                ['Member name', receiptPayment.memberName || 'Not provided'],
                ['Member email', receiptPayment.memberEmail || 'Not provided'],
                ['Member phone', receiptPayment.memberPhone || 'Not provided'],
                ['Receipt date', formatReceiptDateTime(receiptPayment.receiptDate)],
                ['Membership plan', receiptPayment.planName || 'Not provided'],
                ['Membership duration', durationLabel(receiptPayment.durationMonths)],
                ['Membership start date', formatDate(receiptPayment.membershipStartDate)],
                ['Membership expiry date', formatDate(receiptPayment.membershipExpiryDate)],
                ['Membership amount', formatCurrency(receiptPayment.amount)],
                ['Payment method', receiptPayment.preferredMethod || receiptPayment.method || 'Not provided'],
                ['Transaction ID', receiptPayment.transactionRef || receiptPayment.transactionId || 'Not available'],
                ['Payment date', formatReceiptDateTime(receiptPayment.paymentDate)],
                ['Payment status', <StatusBadge key="receipt-status" status={receiptPayment.status} />],
              ].map(([label, value]) => (
                <div className="detail-row" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="member-receipt-total">
              <span>{receiptPayment.status === 'Paid' ? 'TOTAL AMOUNT PAID' : 'RECORDED AMOUNT'}</span>
              <strong>{formatCurrency(receiptPayment.amount)}</strong>
            </div>
            {receiptPayment.status === 'Pending' && (
              <p className="info-note">PENDING: this payment has not been confirmed. This receipt does not indicate successful payment.</p>
            )}
            {receiptPayment.status === 'Failed' && (
              <p className="member-payment-error">FAILED: this receipt reflects a failed payment record and does not indicate successful payment.</p>
            )}
            <p className="member-receipt-thanks">Thank you for choosing ForgeFit!</p>
            {receiptDownloadError && <p className="member-payment-error" role="alert">{receiptDownloadError}</p>}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setReceiptPayment(null)} disabled={receiptDownloading}>Close</button>
              <button type="button" className="btn btn-primary" onClick={downloadReceipt} disabled={receiptDownloading}>
                {receiptDownloading ? 'Preparing PDF...' : 'DOWNLOAD RECEIPT'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
