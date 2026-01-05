import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    { label: 'Spent So Far', value: '$4K+' },
    { label: 'Still Needed', value: '$11K' },
    { label: 'Launch Target', value: 'Q1 2026' }
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
  
  drawSectionHeader('WHAT IS FEEDIN?');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const execSummary = [
    'FEEDIN is a social media app that helps content creators make money from day one.',
    'Unlike Instagram or TikTok where you need thousands of followers before you can earn,',
    'FEEDIN lets anyone receive tips and gifts immediately.',
    '',
    'Think of it as: Instagram + TikTok + Patreon, all in one app.',
    '',
    'HOW FAR WE HAVE COME:',
    '',
    'We started building FEEDIN about 4 months ago (September 2025). So far, we have spent',
    'over $4,000 of our own money and built about 40% of the full app.',
    '',
    'WHAT IS ALREADY WORKING (40% Complete):',
    '• Social feed - Users can post photos, videos, like, comment, and share',
    '• User profiles - People can create accounts and follow each other',
    '• Messaging - Private chats between users',
    '• Credits system - Virtual money that users can buy and send as gifts',
    '• AI tools - Chat assistant and image creation',
    '',
    'WHAT WE STILL NEED TO BUILD (60% Remaining):',
    '• Live streaming - Go live and receive gifts in real-time',
    '• Voice and video calls - Talk directly with followers',
    '• Learn AI section - Educational content about technology',
    '• Final testing and polish before launch'
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
  
  autoTable(doc, {
    startY: yPos,
    head: [['What We Did', 'When', 'Done?', 'Details']],
    body: [
      ['Started the Project', 'Sep 2025', 'Yes', 'Planning and setup'],
      ['Built the Social Feed', 'Sep-Oct 2025', 'Yes', 'Posts, photos, videos, likes'],
      ['Added Messaging', 'Oct-Nov 2025', 'Yes', 'Private chats, friend requests'],
      ['Built Credits System', 'Nov 2025', 'Yes', 'Buy credits, send gifts'],
      ['Added AI Tools', 'Nov-Dec 2025', 'Yes', 'Chat assistant, image creation'],
      ['Built Groups & Search', 'Dec 2025', 'Yes', 'Community groups, find content'],
      ['Live Streaming', 'Jan 2026', 'Building Now', 'Go live, get gifts'],
      ['Voice/Video Calls', 'Jan-Feb 2026', 'Not Started', 'Call your followers'],
      ['Learn AI Section', 'Feb 2026', 'Not Started', 'Tech education content'],
      ['Launch the App', 'Mar 2026', 'Goal', 'Open to the public'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 25 },
      2: { cellWidth: 30 },
      3: { cellWidth: 70 }
    }
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  drawSectionHeader('WHERE THE MONEY GOES');
  
  autoTable(doc, {
    startY: yPos,
    head: [['What We Spend On', 'Total Needed', 'Already Spent', 'Still Need']],
    body: [
      ['Servers & Hosting', '$3,000', '$1,200', '$1,800'],
      ['AI Services (for AI features)', '$2,500', '$800', '$1,700'],
      ['Software Tools', '$1,500', '$500', '$1,000'],
      ['Design & Images', '$1,000', '$400', '$600'],
      ['Live Streaming Tech', '$3,000', '$600', '$2,400'],
      ['Video Calling Tech', '$2,000', '$300', '$1,700'],
      ['Testing', '$1,000', '$200', '$800'],
      ['Marketing at Launch', '$1,000', '$0', '$1,000'],
      ['TOTAL', '$15,000', '$4,000+', '~$11,000'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  drawSectionHeader('WHAT YOUR MONEY WILL DO');
  
  doc.setFontSize(11);
  const investmentImpact = [
    'We need about $11,000 more to finish and launch FEEDIN. Your investment helps us:',
    '',
    '• Finish live streaming - So creators can go live and earn money in real-time',
    '• Build voice and video calls - So creators can talk directly with fans',
    '• Create the Learn AI section - Tech education for our users',
    '• Make the app work smoothly on phones',
    '• Pay for servers when users start joining',
    '• Tell people about the app when we launch'
  ];
  investmentImpact.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 7;
  });
  
  // Page 4 - Features & Revenue
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('PLATFORM FEATURES (BUILT)');
  
  autoTable(doc, {
    startY: yPos,
    head: [['Feature', 'Status', 'Description']],
    body: [
      ['Social Feed', 'Complete', 'Posts with images, videos, likes, comments, shares'],
      ['Stories', 'Complete', '24-hour content with views tracking'],
      ['User Profiles', 'Complete', 'Customizable profiles, followers, following'],
      ['Direct Messaging', 'Complete', 'Real-time chat with media sharing'],
      ['Credit System', 'Complete', 'Virtual currency for gifts and promotions'],
      ['Gifting', 'Complete', 'Send gifts to creators, 85% payout rate'],
      ['AI Copilot', 'Complete', 'Chat assistant powered by advanced AI'],
      ['Image Generation', 'Complete', 'AI-powered image creation'],
      ['Groups', 'Complete', 'Community groups with posts and members'],
      ['Search & Hashtags', 'Complete', 'Discover content and trending topics'],
      ['Premium Subscriptions', 'Complete', 'Monthly plans with exclusive features'],
      ['Creator Payouts', 'Complete', 'Withdraw earnings to bank/wallet'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  drawSectionHeader('HOW FEEDIN MAKES MONEY');
  
  autoTable(doc, {
    startY: yPos,
    head: [['How We Earn', 'Portion', 'Simple Explanation']],
    body: [
      ['Credit Sales', '40%', 'Users buy credits with real money to send gifts'],
      ['Premium Memberships', '25%', 'Users pay monthly for extra features'],
      ['Small Fees on Gifts', '20%', 'We keep 15% when creators cash out gifts'],
      ['Promoted Posts', '10%', 'Creators pay to show their posts to more people'],
      ['Business Accounts', '5%', 'Companies pay for special features (in the future)'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  drawSectionHeader('WHAT WE EXPECT TO HAPPEN (After Launch)');
  
  autoTable(doc, {
    startY: yPos,
    head: [['What We Measure', '3 Months After Launch', '9 Months After Launch', '1 Year Later']],
    body: [
      ['Users Each Month', '1,000', '10,000', '100,000'],
      ['Paying Members', '50', '500', '5,000'],
      ['Money Coming In (Monthly)', '$500', '$5,000', '$50,000'],
      ['Our Costs (Monthly)', '$800', '$2,000', '$15,000'],
      ['When We Make Profit', 'Not yet', 'Getting close', 'Making money'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  // Page 5 - Cap Table & Investment
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('WHO OWNS WHAT (After Investment)');
  
  autoTable(doc, {
    startY: yPos,
    head: [['Who', 'Ownership %', 'What This Means']],
    body: [
      ['Founder & CEO', '40%', 'The person who built the app and runs it daily'],
      ['Co-Founder', '10%', 'Partner helping with business and strategy'],
      ['Investors (You)', '20%', 'The investment being offered now'],
      ['Future Employees', '15%', 'Saved for people we hire later'],
      ['Advisors', '10%', 'Experts who guide us'],
      ['Future Investors', '5%', 'Saved for bigger investments later'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  drawSectionHeader('HOW YOU CAN INVEST');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('What We Are Looking For:', margin, yPos);
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  
  const investmentDetails = [
    '• We want to raise: $15,000 or more',
    '• Smallest investment: $1,000',
    '• What you get: 20% of the company (if we raise the full $15K)',
    '• How we value FEEDIN right now: $75,000',
    '',
    'INVESTMENT OPTIONS:',
    '',
    '$1,000 - $4,999:    You get 2-5% ownership + regular updates + early access to app',
    '$5,000 - $9,999:    You get 6-10% ownership + help guide the product',
    '$10,000 - $15,000:  You get 12-20% ownership + become a key partner',
    '',
    'EVERY INVESTOR GETS:',
    '• Free premium membership forever',
    '• Your name recognized as a founding investor',
    '• Updates every 3 months on how we are doing',
    '• Direct contact with the founders anytime'
  ];
  investmentDetails.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });
  
  // Page 6 - Roadmap & Milestones
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('OUR PLAN FOR 2026');
  
  autoTable(doc, {
    startY: yPos,
    head: [['When', 'What We Will Do', 'What This Means']],
    body: [
      ['January 2026', 'Finish Live Streaming', 'Creators can go live and get gifts'],
      ['February 2026', 'Add Voice/Video Calls', 'Users can call each other directly'],
      ['February 2026', 'Build Learn AI Section', 'Tech education for our users'],
      ['March 2026', 'LAUNCH THE APP', 'Open to everyone, start marketing'],
      ['April-June 2026', 'Get 1,000 users', 'Invite creators, build community'],
      ['July-Sep 2026', 'Get 5,000 users', 'Start making profit'],
      ['Oct-Dec 2026', 'Get 10,000 users', 'Hire more people, grow bigger'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  drawSectionHeader('COMPETITIVE ADVANTAGES');
  
  autoTable(doc, {
    startY: yPos,
    head: [['Feature', 'FEEDIN', 'Instagram', 'TikTok', 'Patreon']],
    body: [
      ['Instant Monetization', 'Yes', 'No', 'No', 'Yes'],
      ['Integrated Live Streaming', 'Yes', 'Yes', 'Yes', 'No'],
      ['AI Content Tools', 'Yes', 'No', 'No', 'No'],
      ['Built-in Credit Economy', 'Yes', 'No', 'Yes', 'No'],
      ['Creator Payout Rate', '85%+', '55%', '50%', '88%'],
      ['Direct Messaging', 'Yes', 'Yes', 'Yes', 'No'],
      ['Voice/Video Calls', 'Yes', 'No', 'No', 'No'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  drawSectionHeader('WHY INVEST NOW?');
  
  doc.setFontSize(11);
  const whyNow = [
    '• Get in Early: This is the earliest and cheapest time to invest',
    '• 40% Already Built: You can see and test what we have made so far',
    '• Small Amount Needed: We only need about $11,000 more to finish and launch',
    '• Big Market: The creator economy is worth over $250 billion and growing fast',
    '• We Build Fast: We built a complex app in 4 months with very little money',
    '• Unique App: No other app combines AI tools with instant creator payments like us'
  ];
  whyNow.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 7;
  });
  
  // Page 7 - Risks & Contact
  doc.addPage();
  yPos = 20;
  
  drawSectionHeader('WHAT COULD GO WRONG (And How We Handle It)');
  
  autoTable(doc, {
    startY: yPos,
    head: [['The Risk', 'How We Deal With It']],
    body: [
      ['We are just starting out', 'We already built 40% of the app; you can try it yourself'],
      ['Big companies like Instagram exist', 'We focus on helping small creators who they ignore'],
      ['Getting users is hard', 'We give free credits to attract people; creators invite their fans'],
      ['App might slow down with many users', 'We built it to handle growth from the start'],
      ['Might take time to make money', 'We have many ways to earn money; we spend carefully'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 115 }
    }
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  drawSectionHeader('WHO WE ARE');
  
  doc.setFontSize(11);
  const team = [
    'Founder & CEO',
    '• A web developer who builds apps using modern technology',
    '• Built the entire FEEDIN app by hand over the past 4 months',
    '• Cares deeply about helping creators earn money fairly',
    '',
    'Co-Founder',
    '• Helps with business ideas and planning',
    '• Works on finding partners and growing the business',
    '',
    'People We Plan to Hire (After We Get Funding):',
    '• Another developer to help build faster',
    '• Someone to help creators and build our community'
  ];
  team.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });
  
  yPos += 10;
  drawSectionHeader('HOW TO INVEST');
  
  doc.setFontSize(11);
  const nextSteps = [
    '1. Read this document carefully',
    '2. Contact us to schedule a call and ask questions',
    '3. We will show you the app and answer all your concerns',
    '4. If you decide to invest, we sign a simple agreement',
    '5. You become a founding investor in FEEDIN!'
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
