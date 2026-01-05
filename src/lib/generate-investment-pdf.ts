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
  doc.text('Pre-Seed / MVP Funding Round', pageWidth / 2, 145, { align: 'center' });
  doc.text('January 2026', pageWidth / 2, 155, { align: 'center' });
  
  // Key metrics on cover
  doc.setFillColor(30, 30, 45);
  doc.roundedRect(margin, 175, pageWidth - 2 * margin, 50, 5, 5, 'F');
  
  doc.setTextColor(99, 102, 241);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const metrics = [
    { label: 'MVP Budget', value: '$15K' },
    { label: 'Spent', value: '$4K+' },
    { label: 'Needed', value: '$11K' },
    { label: 'Launch', value: 'Q1 2026' }
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
    'We started building FEEDIN in September 2025 and have made significant progress over the past',
    '4 months. Our MVP budget is $15,000, of which we have invested $4,000+ of our own capital.',
    'We are seeking funding to complete the remaining features and launch in Q1 2026.',
    '',
    'What We Have Built (70% Complete):',
    '• Full social feed with posts, stories, likes, comments, and shares',
    '• User profiles, follows, friends system, and direct messaging',
    '• Credit economy with purchases, gifts, and creator payouts',
    '• AI Copilot, image generation, thesis writer, and educational Q&A',
    '• Groups, hashtags, trending content, and search functionality',
    '• Premium subscriptions and promotional tools',
    '',
    'What We Need to Complete (30% Remaining):',
    '• Live streaming with real-time gifts and reactions',
    '• Voice and video calling functionality',
    '• Learn AI section with tech education content',
    '• Mobile app optimization and PWA enhancements'
  ];
  
  execSummary.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });
  
  yPos += 5;
  drawSectionHeader('THE PROBLEM WE SOLVE');
  
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
  doc.text('Our Solution:', margin, yPos);
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  
  const solutions = [
    '• Instant monetization through credit-based gifts and tips (no follower requirements)',
    '• Transparent feed with paid promotion as an option, not requirement',
    '• Creators keep 85%+ of earnings—competitive with best-in-class platforms',
    '• Direct messaging, calls, and live interaction with followers'
  ];
  solutions.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });
  
  // Page 3 - Development Progress & Roadmap
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('DEVELOPMENT TIMELINE & PROGRESS');
  
  doc.autoTable({
    startY: yPos,
    head: [['Phase', 'Timeline', 'Status', 'Details']],
    body: [
      ['Project Start', 'Sep 2025', 'Completed', 'Initial architecture and planning'],
      ['Core Social Features', 'Sep-Oct 2025', 'Completed', 'Feed, profiles, posts, stories'],
      ['Messaging & Friends', 'Oct-Nov 2025', 'Completed', 'DMs, friend requests, follows'],
      ['Credit Economy', 'Nov 2025', 'Completed', 'Purchases, gifts, transactions'],
      ['AI Features', 'Nov-Dec 2025', 'Completed', 'Copilot, image gen, thesis writer'],
      ['Groups & Search', 'Dec 2025', 'Completed', 'Groups, hashtags, trending'],
      ['Live Streaming', 'Jan 2026', 'In Progress', 'WebRTC streaming with gifts'],
      ['Voice/Video Calls', 'Jan-Feb 2026', 'Pending', 'P2P calling functionality'],
      ['Learn AI Section', 'Feb 2026', 'Pending', 'Tech education content'],
      ['MVP Launch', 'Q1 2026', 'Target', 'Public launch and user acquisition'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 75 }
    }
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('MVP BUDGET BREAKDOWN');
  
  doc.autoTable({
    startY: yPos,
    head: [['Category', 'Budget', 'Spent', 'Remaining', 'Status']],
    body: [
      ['Infrastructure & Hosting', '$3,000', '$1,200', '$1,800', 'Ongoing'],
      ['API Services & AI', '$2,500', '$800', '$1,700', 'Ongoing'],
      ['Development Tools', '$1,500', '$500', '$1,000', 'Partial'],
      ['Design & Assets', '$1,000', '$400', '$600', 'Partial'],
      ['Live Streaming Infrastructure', '$3,000', '$600', '$2,400', 'In Progress'],
      ['Calling & WebRTC', '$2,000', '$300', '$1,700', 'Pending'],
      ['Testing & QA', '$1,000', '$200', '$800', 'Pending'],
      ['Marketing & Launch', '$1,000', '$0', '$1,000', 'Pending'],
      ['TOTAL', '$15,000', '$4,000+', '~$11,000', '-'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('WHAT YOUR INVESTMENT ENABLES');
  
  doc.setFontSize(11);
  const investmentImpact = [
    'With the remaining ~$11,000 needed to complete MVP, your investment will:',
    '',
    '• Complete live streaming with real-time gifts, reactions, and WebRTC infrastructure',
    '• Build voice and video calling for direct creator-fan communication',
    '• Develop the Learn AI section with curated tech education content',
    '• Optimize mobile experience and PWA for app-like performance',
    '• Cover infrastructure costs for launch and initial user growth',
    '• Fund initial marketing and creator onboarding campaigns'
  ];
  investmentImpact.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 7;
  });
  
  // Page 4 - Features & Revenue
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('PLATFORM FEATURES (BUILT)');
  
  doc.autoTable({
    startY: yPos,
    head: [['Feature', 'Status', 'Description']],
    body: [
      ['Social Feed', '✓ Complete', 'Posts with images, videos, likes, comments, shares'],
      ['Stories', '✓ Complete', '24-hour ephemeral content with views tracking'],
      ['User Profiles', '✓ Complete', 'Customizable profiles, followers, following'],
      ['Direct Messaging', '✓ Complete', 'Real-time chat with media sharing'],
      ['Credit System', '✓ Complete', 'Virtual currency for gifts and promotions'],
      ['Gifting', '✓ Complete', 'Send gifts to creators, 85% payout rate'],
      ['AI Copilot', '✓ Complete', 'Chat assistant powered by advanced AI'],
      ['Image Generation', '✓ Complete', 'AI-powered image creation'],
      ['Groups', '✓ Complete', 'Community groups with posts and members'],
      ['Search & Hashtags', '✓ Complete', 'Discover content and trending topics'],
      ['Premium Subscriptions', '✓ Complete', 'Monthly plans with exclusive features'],
      ['Creator Payouts', '✓ Complete', 'Withdraw earnings to bank/wallet'],
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
      ['Platform Transaction Fees', '20%', '10-15% fee on gifts and creator payouts'],
      ['Promoted Content', '10%', 'Creators pay to boost visibility'],
      ['Enterprise & API', '5%', 'B2B integrations (future)'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('FINANCIAL PROJECTIONS (POST-LAUNCH)');
  
  doc.autoTable({
    startY: yPos,
    head: [['Metric', 'Q2 2026', 'Q4 2026', 'Q4 2027']],
    body: [
      ['Monthly Active Users', '1,000', '10,000', '100,000'],
      ['Premium Subscribers', '50', '500', '5,000'],
      ['Monthly Revenue', '$500', '$5,000', '$50,000'],
      ['Monthly Costs', '$800', '$2,000', '$15,000'],
      ['Break-even Target', '-', 'Q3 2026', 'Profitable'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  // Page 5 - Cap Table & Investment
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('EQUITY STRUCTURE (POST-INVESTMENT)');
  
  doc.autoTable({
    startY: yPos,
    head: [['Shareholder', 'Equity %', 'Notes']],
    body: [
      ['Founder & CEO', '40%', 'Full-time, vested over 4 years'],
      ['Co-Founder', '10%', 'Vested over 4 years with 1-year cliff'],
      ['Pre-Seed Investors', '20%', 'Current funding round'],
      ['ESOP (Employee Pool)', '15%', 'Reserved for key hires'],
      ['Advisors', '10%', 'Industry experts and mentors'],
      ['Future Rounds Reserve', '5%', 'Reserved for Series A'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('INVESTMENT OPPORTUNITY');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('What We Are Seeking:', margin, yPos);
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  
  const investmentDetails = [
    '• Total Raise: $15,000 - $50,000 (flexible based on investor interest)',
    '• Minimum Investment: $1,000',
    '• Equity Offered: 20% (for full $15K raise) - negotiable for larger amounts',
    '• Instrument: SAFE (Simple Agreement for Future Equity) or direct equity',
    '• Valuation Cap: $75,000 pre-money (at MVP stage)',
    '',
    'Investment Tiers:',
    '',
    '$1,000 - $4,999:    2-5% equity + investor updates + early access',
    '$5,000 - $9,999:    6-10% equity + advisory role + product input',
    '$10,000 - $15,000:  12-20% equity + board observer + strategic partner',
    '',
    'Additional benefits for all investors:',
    '• Lifetime premium subscription to FEEDIN',
    '• Recognition as founding investor on platform',
    '• Quarterly progress reports and financial updates',
    '• Direct access to founding team'
  ];
  investmentDetails.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });
  
  // Page 6 - Roadmap & Milestones
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('2026 ROADMAP & MILESTONES');
  
  doc.autoTable({
    startY: yPos,
    head: [['Timeline', 'Milestone', 'Key Deliverables']],
    body: [
      ['Jan 2026', 'Complete Live Streaming', 'WebRTC streaming, real-time gifts, reactions'],
      ['Feb 2026', 'Voice/Video Calling', 'P2P calls, call history, notifications'],
      ['Feb 2026', 'Learn AI Section', 'Tech tutorials, AI-curated content'],
      ['Mar 2026', 'MVP Launch', 'Public launch, initial marketing push'],
      ['Q2 2026', '1,000 MAU', 'Creator onboarding, community building'],
      ['Q3 2026', '5,000 MAU', 'Revenue optimization, break-even target'],
      ['Q4 2026', '10,000 MAU', 'Series A preparation, team expansion'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('COMPETITIVE ADVANTAGES');
  
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
      ['Voice/Video Calls', '✓', '✗', '✗', '✗'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('WHY INVEST NOW?');
  
  doc.setFontSize(11);
  const whyNow = [
    '• Ground Floor Opportunity: Join at pre-seed/MVP stage with maximum upside',
    '• 70% Already Built: Majority of platform is functional and demonstrable',
    '• Small Capital Needed: Only ~$11K to complete MVP and launch',
    '• Creator Economy Boom: $250B+ market growing 20%+ annually',
    '• Proven Team Execution: Built complex platform in 4 months with minimal capital',
    '• First-Mover Features: AI integration + instant monetization is unique combination'
  ];
  whyNow.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 7;
  });
  
  // Page 7 - Risks & Contact
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('RISK FACTORS');
  
  doc.autoTable({
    startY: yPos,
    head: [['Risk', 'Mitigation Strategy']],
    body: [
      ['Early Stage', 'MVP 70% complete; demonstrable product; lean operations'],
      ['Market Competition', 'Focus on underserved creator needs; rapid iteration'],
      ['User Acquisition', 'Credit incentives; creator referrals; organic growth'],
      ['Technical Scaling', 'Cloud-native architecture; CDN; modular design'],
      ['Revenue Timeline', 'Multiple revenue streams from day one; low burn rate'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 125 }
    }
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  drawSectionHeader('TEAM');
  
  doc.setFontSize(11);
  const team = [
    'Founder & CEO',
    '• Full-stack developer with experience in React, Node.js, and cloud infrastructure',
    '• Built entire FEEDIN platform from scratch over 4 months',
    '• Passionate about creator empowerment and fair monetization',
    '',
    'Co-Founder',
    '• Supports product vision and business development',
    '• Contributes to strategic planning and partnerships',
    '',
    'Post-Funding Hires (Planned):',
    '• Senior Developer (Q2 2026) - Scale infrastructure and features',
    '• Community Manager (Q2 2026) - Creator relations and growth'
  ];
  team.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });
  
  yPos += 10;
  drawSectionHeader('NEXT STEPS');
  
  doc.setFontSize(11);
  const nextSteps = [
    '1. Review this memorandum and explore the live platform at feedin.app',
    '2. Schedule a call with our founder to discuss the opportunity',
    '3. Receive demo access and see features in action',
    '4. Complete investment via SAFE agreement or direct equity',
    '5. Join us as a founding investor in the creator economy revolution'
  ];
  nextSteps.forEach(step => {
    doc.text(step, margin, yPos);
    yPos += 7;
  });
  
  yPos += 10;
  doc.setFillColor(240, 240, 250);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 35, 3, 3, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.text('Contact Information', margin + 5, yPos + 10);
  doc.setFont('helvetica', 'normal');
  doc.text('Investor Relations: investors@feedin.app', margin + 5, yPos + 20);
  doc.text('Founding Team: founders@feedin.app', margin + 5, yPos + 28);
  
  // Disclaimer footer
  yPos += 50;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const disclaimer = 'DISCLAIMER: This document is for informational purposes only and does not constitute an offer to sell or solicitation to buy securities. All investments carry risk, especially at the early stage. Past performance does not guarantee future results. Prospective investors should conduct their own due diligence and consult with financial, legal, and tax advisors before making any investment decision. FEEDIN is a pre-revenue startup and investment may result in total loss of capital.';
  const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 2 * margin);
  doc.text(splitDisclaimer, margin, yPos);
  
  // Save the PDF
  doc.save('FEEDIN_Investment_Memorandum_2026.pdf');
};
