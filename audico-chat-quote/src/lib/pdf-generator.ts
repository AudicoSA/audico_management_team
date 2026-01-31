import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { QuoteItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

// Audico Brand Colors
const COLORS = {
    black: "#000000",
    lightGrey: "#f3f4f6", // Background for right side
    darkGrey: "#1f2937",
    accentGreen: "#c8ff00", // The Audico lime green
    white: "#ffffff",
    textGrey: "#6b7280",
    tableHeader: "#9ca3af",
};

export interface QuoteDetails {
    quoteId: string;
    customerName?: string;
    customerAddress?: string;
    customerEmail?: string;
    customerPhone?: string;
    companyName?: string;
    vatNumber?: string;
    items: QuoteItem[];
}

export const generateQuotePDF = async (details: QuoteDetails) => {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const sidebarWidth = 70; // Width of the black sidebar on the left

    // --- Backgrounds ---

    // Left Sidebar (Black)
    doc.setFillColor(COLORS.black);
    doc.rect(0, 0, sidebarWidth, pageHeight, "F");

    // Right Content Area (Light Grey)
    doc.setFillColor(COLORS.lightGrey);
    doc.rect(sidebarWidth, 0, pageWidth - sidebarWidth, pageHeight, "F");

    // --- Left Sidebar Content ---

    // Logo (Mockup placeholder - ideally fetch 'logo.png' and addImage)
    try {
        const logoImg = new Image();
        logoImg.src = "/logo.png";
        await new Promise((resolve, reject) => {
            logoImg.onload = resolve;
            logoImg.onerror = resolve; // Continue even if logo fails
        });
        // Add logo if loaded
        if (logoImg.complete && logoImg.naturalHeight !== 0) {
            // Aspect ratio
            const ratio = logoImg.width / logoImg.height;
            const logoWidth = 50;
            const logoHeight = logoWidth / ratio;
            doc.addImage(logoImg, "PNG", 10, 15, logoWidth, logoHeight);
        } else {
            // Fallback text if no logo
            doc.setTextColor(COLORS.white);
            doc.setFontSize(24);
            doc.setFont("helvetica", "bold");
            doc.text("audico", 10, 25);
        }
    } catch (e) {
        console.error("Failed to load logo", e);
    }

    // Customer Details Section
    let yPos = 80;
    doc.setTextColor(COLORS.white);
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Issue to:", 10, yPos);

    yPos += 15;
    doc.setFontSize(10);

    // Customer info helper to wrap text
    const printWrapped = (text: string, fontSize: number = 10, bottomMargin: number = 5) => {
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, 50); // Wrap to 50mm width (Sidebar is 70mm, 10mm padding)
        doc.text(lines, 10, yPos);
        yPos += (lines.length * 5) + bottomMargin;
    };

    const customerName = details.customerName || "Business if any\nCustomer Name";
    const company = details.companyName ? `\n${details.companyName}` : "";
    printWrapped(customerName + company, 10, 10);

    const address = details.customerAddress || "Customer Address\nCity\nArea\nCode";
    printWrapped(address, 10, 10);

    const email = details.customerEmail || "Customer Email";
    printWrapped(email, 10, 5);

    if (details.customerPhone) {
        printWrapped(details.customerPhone, 10, 5);
    }

    // Footer Info (Payment Method)
    // Moved up to accommodate bank details (was -70)
    yPos = pageHeight - 85;
    doc.setFontSize(10);
    doc.setTextColor(COLORS.white);
    doc.text("PAYMENT METHOD", 10, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.text("Card | EFT | Zapper", 10, yPos);

    yPos += 7; // Reduced from 10 to be tighter
    doc.text("AUDICO FNB", 10, yPos);
    yPos += 5;
    doc.text("62240761660", 10, yPos);
    yPos += 5;
    doc.text("220629", 10, yPos);

    // Terms Section (Green Header)
    yPos += 20;
    doc.setFontSize(12);
    doc.setTextColor(COLORS.accentGreen);
    doc.setFont("helvetica", "bold");
    doc.text("TERMS", 10, yPos);

    yPos += 7;
    doc.setFontSize(8);
    doc.setTextColor(COLORS.white);
    doc.setFont("helvetica", "normal");
    const termsText = [
        "All invoice must be paid within",
        "14 days Automated quotes do",
        "not check stock",
        "Subject to cancellation for any errors"
    ];
    doc.text(termsText, 10, yPos);


    // --- Right Content Area ---

    const rightMargin = sidebarWidth + 10;

    // Header Info
    doc.setTextColor(COLORS.black);
    doc.setFontSize(10);

    // Generate Invoice Number or use provided
    let invoiceNo = details.quoteId;

    // If no valid PF number provided, generate one
    if (!invoiceNo || !invoiceNo.startsWith("PF")) {
        const today = new Date();
        const yy = today.getFullYear().toString().slice(-2);
        const mm = (today.getMonth() + 1).toString().padStart(2, '0');
        const dd = today.getDate().toString().padStart(2, '0');
        const randomSeq = Math.floor(Math.random() * 900) + 100;
        invoiceNo = `PF${yy}${mm}${dd}-${randomSeq}`;
    }

    doc.text(`Invoice No: ${invoiceNo}`, pageWidth - 10, 20, { align: "right" });

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PRO-FORMA INVOICE", pageWidth - 10, 30, { align: "right" });

    // Items Table
    // autoTable config
    const tableHeaders = [["DESCRIPTION", "QTY", "UNIT", "TOTAL"]];

    const tableData = details.items.map(item => {
        // Clean up description logic
        let description = item.product.name || "";
        // Remove HTML entities
        description = description.replace(/&amp;/g, "&").replace(/&quot;/g, '"');

        // Improve wrapping/length handling
        if (description.length > 50 && description.includes(" - ")) {
            description = description.split(" - ")[0];
        } else if (description.length > 65) {
            // Cut off at last space before 65 chars if possible to prevent 3-line wrapping
            const cut = description.substring(0, 65).lastIndexOf(" ");
            if (cut > 45) description = description.substring(0, cut) + "...";
        }

        return [
            description,
            item.quantity.toString(),
            formatCurrency(item.product.price), // Using product price
            formatCurrency(item.lineTotal)
        ];
    });

    // Calculate totals (Prices are VAT Inclusive)
    const totalInclusive = details.items.reduce((sum, item) => sum + item.lineTotal, 0);
    // VAT Rate 15%
    const vatRate = 0.15;
    const subTotal = totalInclusive / (1 + vatRate);
    const vatAmount = totalInclusive - subTotal;

    // @ts-ignore
    autoTable(doc, {
        startY: 50,
        margin: { left: rightMargin, right: 10 },
        head: tableHeaders,
        body: tableData,
        theme: 'plain',
        headStyles: {
            fillColor: COLORS.tableHeader,
            textColor: COLORS.white,
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'left'
        },
        styles: {
            fontSize: 9,
            cellPadding: 3,
            overflow: 'linebreak',
            cellWidth: 'wrap'
        },
        columnStyles: {
            // Content width reduced to 115mm (was 120mm) to ensure 5mm right margin safety
            0: { cellWidth: 55 }, // Description (Reduced 5mm)
            1: { cellWidth: 12, halign: 'center' }, // Qty
            2: { cellWidth: 23, halign: 'right' }, // Unit
            3: { cellWidth: 25, halign: 'right' } // Total
        },
        alternateRowStyles: {
            fillColor: COLORS.white
        },
    });

    // @ts-ignore
    const finalY = doc.lastAutoTable.finalY + 10;

    // Totals Section
    const summaryX = pageWidth - 60;
    const summaryValX = pageWidth - 10;
    let currentY = finalY;

    // Setup styles for summary
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    // Subtotal (Excl VAT)
    doc.text("SUBTOTAL (Excl)", summaryX, currentY);
    doc.text(formatCurrency(subTotal), summaryValX, currentY, { align: "right" });

    // VAT
    currentY += 6;
    doc.text("VAT (15%)", summaryX, currentY);
    doc.text(formatCurrency(vatAmount), summaryValX, currentY, { align: "right" });

    // Total Bar (Dark Grey background)
    currentY += 6;
    doc.setFillColor(COLORS.darkGrey);
    doc.rect(summaryX - 5, currentY - 4, 65, 8, "F");

    doc.setTextColor(COLORS.white);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", summaryX, currentY + 1);
    doc.text(formatCurrency(totalInclusive), summaryValX, currentY + 1, { align: "right" });

    // Footer "Thank You"
    currentY += 20;
    doc.setTextColor(COLORS.textGrey);
    doc.setFont("times", "italic");
    doc.setFontSize(16);
    doc.text("Thank You!", pageWidth - 10, currentY, { align: "right" });

    // Approved By Area
    const approvedY = pageHeight - 40;
    doc.setTextColor(COLORS.black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("APPROVED BY.", rightMargin, approvedY);

    doc.setFontSize(14);
    doc.text(details.customerName || "CUSTOMER NAME", rightMargin, approvedY + 10);

    // Bottom Company Info
    const bottomY = pageHeight - 15;
    doc.setFontSize(7);
    doc.setTextColor(COLORS.textGrey);
    const companyInfo = "AUDICO (Homelogic T/A) Shop 7 Zimbali Wedge, 1 Zimbali Drive, Ballito 4420\nTelephone 010 0202882 | sales@audico.co.za | www.audicoonline.co.za";
    doc.text(companyInfo, rightMargin, bottomY);

    // Save PDF
    // Append timestamp to ensure unique filename if multiple generated for same quote in session
    doc.save(`Audico_Quote_${invoiceNo}.pdf`);
};
