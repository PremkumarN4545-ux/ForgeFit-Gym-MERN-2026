import { formatCurrency, formatDate, durationLabel } from './format';

const text = (value) => String(value || 'Not provided');

export async function downloadMembershipReceipt(payment) {
  const receiptNumber = payment?.receiptNumber || payment?.paymentId;
  if (!receiptNumber || !['Paid', 'Pending', 'Failed'].includes(payment?.status)) {
    throw new Error('A receipt requires an existing payment record with a valid status.');
  }

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const width = pdf.internal.pageSize.getWidth();
  const margin = 52;
  const valueX = 212;
  const valueWidth = width - valueX - margin;
  const amount = formatCurrency(payment.amount).replace('₹', 'INR ');
  const paymentStatus = payment.status === 'Pending'
    ? 'PENDING - awaiting confirmation'
    : payment.status.toUpperCase();
  const receiptDate = payment.receiptDate
    ? new Date(payment.receiptDate).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not available';
  const paidAt = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not provided';

  pdf.setFillColor(15, 37, 87);
  pdf.rect(0, 0, width, 118, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.text('ForgeFit', margin, 54);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text('GYM MEMBERSHIP PAYMENT RECEIPT', margin, 78);
  pdf.setFontSize(10);
  pdf.text(`Receipt No. ${text(receiptNumber)}`, width - margin, 54, { align: 'right' });

  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text('Payment receipt', margin, 156);
  pdf.setDrawColor(226, 232, 240);
  pdf.line(margin, 169, width - margin, 169);

  const rows = [
    ['Receipt date', receiptDate],
    ['Member name', payment.memberName],
    ['Member email', payment.memberEmail],
    ['Member phone', payment.memberPhone],
    ['Membership plan', payment.planName],
    ['Membership duration', durationLabel(payment.durationMonths || payment.planDurationMonths || payment.plan?.durationMonths)],
    ['Membership start date', formatDate(payment.membershipStartDate)],
    ['Membership expiry date', formatDate(payment.membershipExpiryDate)],
    ['Transaction ID', payment.transactionId || payment.transactionRef || 'Not available'],
    ['Payment method', payment.preferredMethod || payment.method],
    ['Payment date and time', paidAt],
    ['Payment status', paymentStatus],
  ];

  let y = 198;
  rows.forEach(([label, rawValue], index) => {
    const value = pdf.splitTextToSize(text(rawValue), valueWidth);
    const rowHeight = Math.max(28, value.length * 14 + 12);
    if (index % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin - 8, y - 16, width - 2 * margin + 16, rowHeight, 4, 4, 'F');
    }
    pdf.setTextColor(100, 116, 139);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(label, margin, y);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.text(value, valueX, y);
    y += rowHeight;
  });

  y += 12;
  pdf.setFillColor(239, 246, 255);
  pdf.roundedRect(margin - 8, y - 20, width - 2 * margin + 16, 54, 6, 6, 'F');
  pdf.setTextColor(15, 37, 87);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(payment.status === 'Paid' ? 'TOTAL AMOUNT PAID' : 'RECORDED AMOUNT', margin, y + 2);
  pdf.setFontSize(17);
  pdf.text(amount, width - margin, y + 5, { align: 'right' });

  pdf.setTextColor(100, 116, 139);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Receipt status reflects the payment record at the time of generation.', margin, 790);
  pdf.text('Thank you for choosing ForgeFit!', width - margin, 790, { align: 'right' });
  const safeReceiptNumber = String(receiptNumber).replace(/[^A-Za-z0-9_-]/g, '_');
  pdf.save(`ForgeFit_Receipt_${safeReceiptNumber}.pdf`);
}
