import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export const generateInvestmentPDF = () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > 270) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Helper to draw section header
  const drawSectionHeader = (title: string) => {
    checkPageBreak(20);
    doc.setFillColor(99, 102, 241); // Primary color
    doc.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 5, yPos + 7);
    doc.setTextColor(0, 0, 0);
    yPos += 15;
  };

  // Cover Page
  doc.setFillColor(15, 15, 25);
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
  
  // Logo placeholder
  doc.setFillColor(99, 102, 241);
  doc.circle(pageWidth / 2, 60, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('F', pageWidth / 2 - 7, 68);
  
  // Title
  doc.setFontSize(36);
  doc.text('FEEDIN', pageWidth / 2, 100, { align: 'center' });
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text('Investment Memorandum', pageWidth / 2, 115, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(180, 180, 180);
  doc.text('CONFIDENTIAL', pageWidth / 2, 135, { align: 'center' });
  doc.text('Series Seed Funding Round', pageWidth / 2, 145, { align: 'center' });
  doc.text('January 2026', pageWidth / 2, 155, { align: 'center' });
  
  // Key metrics on cover
  doc.setFillColor(30, 30, 45);
  doc.roundedRect(margin, 175, pageWidth - 2 * margin, 50, 5, 5, 'F');
  
  doc.setTextColor(99, 102, 241);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const metrics = [
    { label: 'Raising', value: '$1M' },
    { label: 'Valuation', value: '$5M' },
    { label: 'Equity', value: '20%' },
    { label: 'Runway', value: '18 mo' }
  ];
  
  const metricWidth = (pageWidth - 2 * margin) / 4;
  metrics.forEach((m, i) => {
    const x = margin + metricWidth * i + metricWidth / 2;
    doc.text(m.value, x, 195, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(m.label, x, 210, { align: 'center' });
    doc.setFontSize(20);
    doc.setTextColor(99, 102, 241);
  });
  
  // Contact on cover
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text('Contact: investors@feedin.app', pageWidth / 2, 260, { align: 'center' });
  doc.text('This document contains confidential information.', pageWidth / 2, 270, { align: 'center' });
  doc.text('Do not distribute without permission.', pageWidth / 2, 277, { align: 'center' });
  
  // Page 2 - Executive Summary
  doc.addPage();
  doc.setTextColor(0, 0, 0);
  yPos = 20;
  
  drawSectionHeader('EXECUTIVE SUMMARY');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const execSummary = [
    'FEEDIN is a next-generation social media platform that puts creators first. We combine social',
    'networking, live streaming, AI-powered tools, and an integrated credit economy to enable creators',
    'to monetize their content from day one—no follower thresholds, no waiting periods.',
    '',
    'Our platform addresses the fundamental problem with existing social media: creators do the work,',
    'but platforms capture most of the value. FEEDIN flips this model by giving creators 85%+ of their',
    'earnings and providing instant monetization from their very first post.',
    '',
    'Key Differentiators:',
    '• Instant monetization through credit-based gifts and tips (no follower requirements)',
    '• Integrated AI suite for content creation, image generation, and smart assistance',
    '• Unified experience: social feed, live streaming, messaging, and monetization in one app',
    '• Proprietary credit economy that creates engagement loops and revenue predictability',
    '• Low-latency WebRTC live streaming with real-time gifts and reactions',
    '• Privacy-first architecture with row-level security and encrypted messaging'
  ];
  
  execSummary.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });
  
  yPos += 10;
  drawSectionHeader('THE PROBLEM');
  
  doc.setFont('helvetica', 'bold');
  doc.text('For Creators:', margin, yPos);
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  
  const creatorProblems = [
    '• Monetization gatekept behind arbitrary follower thresholds (1K, 10K, 100K followers)',
    '• Opaque algorithms that suppress reach unless creators pay for ads',
    '• Platforms take 30-50% of creator earnings',
    '• No direct relationship with audience—platform owns the connection'
  ];
  creatorProblems.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });
  
  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('For Users:', margin, yPos);
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  
  const userProblems = [
    '• Fragmented experience across multiple apps for different needs',
    '• No way to directly support favorite creators without platform taking large cut',
    '• Bombarded with ads and algorithmic content they didnt ask for',
    '• Privacy concerns with data harvesting and tracking'
  ];
  userProblems.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });
  
  // Page 3 - Traction
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('TRACTION & KEY METRICS');
  
  doc.autoTable({
    startY: yPos,
    head: [['Metric', 'Current Value', 'YoY Growth']],
    body: [
      ['Monthly Active Users', '50,000+', '+340%'],
      ['Daily Posts Created', '10,000+', '+280%'],
      ['Countries Reached', '25+', 'Expanding'],
      ['Credits Transacted', '1,000,000+', '+450%'],
      ['Live Streams Hosted', '5,000+', '+520%'],
      ['Messages Sent Daily', '100,000+', '+380%'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('REVENUE MODEL');
  
  doc.autoTable({
    startY: yPos,
    head: [['Revenue Stream', 'Share', 'Description']],
    body: [
      ['Credit Purchases', '40%', 'Users buy credits for gifts, promotions, AI features'],
      ['Premium Subscriptions', '25%', 'Monthly/annual premium memberships'],
      ['Platform Transaction Fees', '20%', '10-15% fee on gifts, P2P trades, payouts'],
      ['Promoted Content', '10%', 'Creators pay to boost visibility'],
      ['Enterprise & API', '5%', 'B2B integrations and white-label solutions'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('FINANCIAL PROJECTIONS');
  
  doc.autoTable({
    startY: yPos,
    head: [['Metric', 'Year 1', 'Year 2', 'Year 3']],
    body: [
      ['Monthly Active Users', '100K', '500K', '2M'],
      ['Premium Subscribers', '5K', '35K', '150K'],
      ['Monthly Revenue', '$50K', '$350K', '$1.5M'],
      ['Annual Revenue', '$600K', '$4.2M', '$18M'],
      ['Gross Margin', '70%', '75%', '80%'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  // Page 4 - Cap Table & Use of Funds
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('CAP TABLE (POST-INVESTMENT)');
  
  doc.autoTable({
    startY: yPos,
    head: [['Shareholder', 'Equity %', 'Notes']],
    body: [
      ['Founders (CEO & Co-Founder)', '50%', 'Vested over 4 years with 1-year cliff'],
      ['Series Seed Investors', '20%', 'Current funding round allocation'],
      ['ESOP (Employee Stock Pool)', '15%', 'Reserved for key hires and team expansion'],
      ['Advisors & Strategic Partners', '10%', 'Industry experts and growth partners'],
      ['Future Rounds Reserve', '5%', 'Reserved for Series A and beyond'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('USE OF FUNDS ($1M RAISE)');
  
  doc.autoTable({
    startY: yPos,
    head: [['Category', 'Amount', 'Allocation', 'Details']],
    body: [
      ['Product Development', '$350,000', '35%', 'AI features, streaming, mobile apps'],
      ['User Acquisition', '$250,000', '25%', 'Marketing, influencers, growth campaigns'],
      ['Team Expansion', '$200,000', '20%', 'Engineering, design, community'],
      ['Infrastructure', '$120,000', '12%', 'Servers, CDN, security, compliance'],
      ['Operations & Legal', '$80,000', '8%', 'Legal, accounting, office, misc'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('INVESTMENT TERMS');
  
  doc.setFontSize(11);
  const terms = [
    '• Instrument: SAFE (Simple Agreement for Future Equity)',
    '• Valuation Cap: $5,000,000 (pre-money)',
    '• Discount: 20% on next priced round',
    '• Minimum Investment: $25,000',
    '• Pro-rata Rights: Yes, for investments ≥ $50,000',
    '• Information Rights: Quarterly updates for all investors',
    '• Board Seat: Observer seat for lead investor ($250K+)'
  ];
  terms.forEach(term => {
    doc.text(term, margin, yPos);
    yPos += 7;
  });
  
  // Page 5 - Milestones & Team
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('2026 ROADMAP & MILESTONES');
  
  doc.autoTable({
    startY: yPos,
    head: [['Quarter', 'Goal', 'Key Initiatives']],
    body: [
      ['Q1 2026', '100K MAU', 'Launch mobile apps (iOS/Android), expand AI features'],
      ['Q2 2026', '250K MAU', 'Enter 10 new markets, creator partnership program'],
      ['Q3 2026', '500K MAU', 'Launch premium subscriptions at scale'],
      ['Q4 2026', '1M MAU', 'Series A preparation, break-even trajectory'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('TEAM & KEY HIRES');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Current Team:', margin, yPos);
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('Founder-led team with full-stack development, product design, and go-to-market experience.', margin, yPos);
  yPos += 6;
  doc.text('Built the entire platform from scratch with a focus on scalability and user experience.', margin, yPos);
  yPos += 12;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Planned Hires (Post-Funding):', margin, yPos);
  yPos += 7;
  
  doc.autoTable({
    startY: yPos,
    head: [['Role', 'Priority', 'Timeline']],
    body: [
      ['CTO / Lead Engineer', 'Critical', 'Q1 2026'],
      ['Head of Growth', 'High', 'Q1 2026'],
      ['Senior Full-Stack Engineers (2)', 'High', 'Q1-Q2 2026'],
      ['Mobile Developer (iOS/Android)', 'High', 'Q2 2026'],
      ['Community Manager', 'Medium', 'Q2 2026'],
      ['Content & Creator Relations', 'Medium', 'Q2 2026'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  // Page 6 - Risks & Contact
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('RISK FACTORS & MITIGATION');
  
  doc.autoTable({
    startY: yPos,
    head: [['Risk', 'Mitigation Strategy']],
    body: [
      ['Market Competition', 'Focus on creator-first features; rapid iteration and innovation'],
      ['User Acquisition Cost', 'Viral referral system with credit incentives; organic growth'],
      ['Regulatory Changes', 'Privacy-first architecture; compliance-ready; legal counsel'],
      ['Technology Scaling', 'Cloud-native architecture; CDN; modular microservices'],
      ['Creator Retention', 'Competitive 85%+ payout rates; instant monetization'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 120 }
    }
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('COMPETITIVE LANDSCAPE');
  
  doc.autoTable({
    startY: yPos,
    head: [['Feature', 'FEEDIN', 'Instagram', 'TikTok', 'Patreon']],
    body: [
      ['Instant Monetization', '✓', '✗', '✗', '✓'],
      ['Integrated Live Streaming', '✓', '✓', '✓', '✗'],
      ['AI Content Tools', '✓', '✗', '✗', '✗'],
      ['Built-in Credit Economy', '✓', '✗', '✓', '✗'],
      ['Creator Payout Rate', '85%+', '55%', '50%', '88%'],
      ['Direct Messaging', '✓', '✓', '✓', '✗'],
      ['P2P Trading', '✓', '✗', '✗', '✗'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = doc.lastAutoTable.finalY + 20;
  
  drawSectionHeader('NEXT STEPS');
  
  doc.setFontSize(11);
  const nextSteps = [
    '1. Schedule an intro call with our founding team',
    '2. Receive detailed financial projections and data room access',
    '3. Complete due diligence and legal review',
    '4. Sign SAFE agreement and wire funds'
  ];
  nextSteps.forEach(step => {
    doc.text(step, margin, yPos);
    yPos += 8;
  });
  
  yPos += 10;
  doc.setFillColor(240, 240, 250);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 40, 3, 3, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.text('Contact Information', margin + 5, yPos + 10);
  doc.setFont('helvetica', 'normal');
  doc.text('Investor Relations: investors@feedin.app', margin + 5, yPos + 20);
  doc.text('Founding Team: founders@feedin.app', margin + 5, yPos + 28);
  doc.text('We typically respond within 24-48 hours', margin + 5, yPos + 36);
  
  // Disclaimer footer
  yPos += 55;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const disclaimer = 'DISCLAIMER: This document is for informational purposes only and does not constitute an offer to sell or solicitation to buy securities. All investments carry risk and past performance does not guarantee future results. Prospective investors should conduct their own due diligence and consult with financial, legal, and tax advisors before making any investment decision.';
  const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 2 * margin);
  doc.text(splitDisclaimer, margin, yPos);
  
  // Save the PDF
  doc.save('FEEDIN_Investment_Memorandum_2026.pdf');
};
