import { jsPDF } from 'jspdf';

export interface ReceiptPdfInput {
  receiptNumber?: string;
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  programName?: string;
  courseName: string;
  level?: string;
  enrollmentId?: string;
  registrationNumber?: string;
  transactionId?: string;
  transactionDate: string;
  paymentMethod: string;
  reference?: string;
  amountPaid: number;
  totalFee: number;
  totalPaidToDate: number;
  outstandingBalance: number;
  paymentStatus: string;
}

const toText = (value: unknown) => String(value ?? '').trim();
const money = (amount: number) => `Ksh ${Number(amount || 0).toLocaleString('en-KE')}`;

export const buildReceiptNumber = (transactionDate: string, transactionId: string) =>
  `LC-${String(transactionDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '')}-${String(transactionId || '').slice(0, 8).toUpperCase()}`;

const drawMetaField = (
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  const lines = doc.splitTextToSize(value || '-', width);
  doc.text(lines, x, y + 12);
  return y + 12 + lines.length * 12 + 8;
};

export const downloadReceiptPdf = (input: ReceiptPdfInput) => {
  const receiptNumber = toText(input.receiptNumber) || buildReceiptNumber(input.transactionDate, input.transactionId || '');
  const issuedAt = new Date().toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, margin, pageWidth - margin * 2, 84, 10, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Lingua Center Receipt', margin + 18, margin + 33);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Official Fee Payment Confirmation', margin + 18, margin + 52);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Receipt No', pageWidth - margin - 190, margin + 27);
  doc.text('Issued At', pageWidth - margin - 190, margin + 50);
  doc.setFont('helvetica', 'normal');
  doc.text(receiptNumber, pageWidth - margin - 120, margin + 27);
  doc.text(issuedAt, pageWidth - margin - 120, margin + 50);

  let leftY = margin + 120;
  let rightY = margin + 120;
  const colWidth = (pageWidth - margin * 2 - 24) / 2;
  const rightX = margin + colWidth + 24;

  leftY = drawMetaField(doc, 'Student Name', toText(input.studentName) || '-', margin, leftY, colWidth);
  leftY = drawMetaField(doc, 'Student Email', toText(input.studentEmail) || '-', margin, leftY, colWidth);
  leftY = drawMetaField(doc, 'Telephone', toText(input.studentPhone) || '-', margin, leftY, colWidth);
  leftY = drawMetaField(doc, 'Program', toText(input.programName) || '-', margin, leftY, colWidth);

  rightY = drawMetaField(doc, 'Course', toText(input.courseName) || '-', rightX, rightY, colWidth);
  rightY = drawMetaField(doc, 'Level', toText(input.level) || '-', rightX, rightY, colWidth);
  rightY = drawMetaField(doc, 'Enrollment ID', toText(input.enrollmentId) || '-', rightX, rightY, colWidth);
  rightY = drawMetaField(doc, 'Registration No', toText(input.registrationNumber) || '-', rightX, rightY, colWidth);

  let y = Math.max(leftY, rightY) + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.text('Payment Details', margin, y);

  const tableY = y + 12;
  const tableW = pageWidth - margin * 2;
  const headerH = 24;
  const rowH = 28;
  const col1 = 120;
  const col2 = 110;
  const col3 = tableW - col1 - col2 - 100;
  const col4 = 100;

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, tableY, tableW, headerH, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, tableY, tableW, headerH + rowH);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Date', margin + 8, tableY + 16);
  doc.text('Method', margin + col1 + 8, tableY + 16);
  doc.text('Reference', margin + col1 + col2 + 8, tableY + 16);
  doc.text('Amount', margin + tableW - 8, tableY + 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 24, 39);
  doc.text(toText(input.transactionDate) || '-', margin + 8, tableY + headerH + 18);
  doc.text(toText(input.paymentMethod) || '-', margin + col1 + 8, tableY + headerH + 18);
  const referenceLines = doc.splitTextToSize(toText(input.reference) || '-', col3 - 16);
  doc.text(referenceLines[0] || '-', margin + col1 + col2 + 8, tableY + headerH + 18);
  doc.setFont('helvetica', 'bold');
  doc.text(money(input.amountPaid), margin + tableW - 8, tableY + headerH + 18, { align: 'right' });

  const summaryW = 240;
  const summaryX = pageWidth - margin - summaryW;
  const summaryY = tableY + headerH + rowH + 18;
  const summaryRowH = 24;
  const summaryRows = [
    ['Total Course Fee', money(input.totalFee)],
    ['Total Paid To Date', money(input.totalPaidToDate)],
    ['Outstanding Balance', money(input.outstandingBalance)],
    ['Payment Status', toText(input.paymentStatus) || 'PENDING']
  ];

  doc.setDrawColor(226, 232, 240);
  doc.rect(summaryX, summaryY, summaryW, summaryRowH * summaryRows.length);
  summaryRows.forEach((row, idx) => {
    const ry = summaryY + idx * summaryRowH;
    if (idx > 0) doc.line(summaryX, ry, summaryX + summaryW, ry);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(row[0], summaryX + 10, ry + 16);
    doc.setFont('helvetica', idx === summaryRows.length - 1 ? 'bold' : 'normal');
    doc.setTextColor(17, 24, 39);
    doc.text(row[1], summaryX + summaryW - 10, ry + 16, { align: 'right' });
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'This receipt is system-generated by Lingua Center Management System.',
    margin,
    doc.internal.pageSize.getHeight() - 30
  );

  doc.save(`receipt-${receiptNumber}.pdf`);
};
