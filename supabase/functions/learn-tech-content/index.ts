import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Curated tech learning content
const techCategories = [
  {
    id: 'web-dev',
    label: 'Web Development',
    topics: [
      { title: 'HTML & CSS Basics', description: 'Learn the fundamentals of web structure and styling', difficulty: 'beginner' },
      { title: 'JavaScript Essentials', description: 'Master the language of the web', difficulty: 'beginner' },
      { title: 'React Fundamentals', description: 'Build modern user interfaces with React', difficulty: 'intermediate' },
      { title: 'TypeScript for React', description: 'Add type safety to your React apps', difficulty: 'intermediate' },
      { title: 'Next.js Full Stack', description: 'Build full-stack apps with Next.js', difficulty: 'advanced' },
    ],
    videos: [
      { id: 'UB1O30fR-EE', title: 'HTML Crash Course for Beginners', channel: 'Traversy Media' },
      { id: 'yfoY53QXEnI', title: 'CSS Crash Course', channel: 'Traversy Media' },
      { id: 'hdI2bqOjy3c', title: 'JavaScript Crash Course', channel: 'Traversy Media' },
      { id: 'w7ejDZ8SWv8', title: 'React JS Crash Course', channel: 'Traversy Media' },
    ]
  },
  {
    id: 'mobile-dev',
    label: 'Mobile Development',
    topics: [
      { title: 'React Native Basics', description: 'Build cross-platform mobile apps', difficulty: 'intermediate' },
      { title: 'Flutter Development', description: 'Create beautiful apps with Flutter', difficulty: 'intermediate' },
      { title: 'iOS with Swift', description: 'Native iOS development', difficulty: 'intermediate' },
    ],
    videos: [
      { id: '0-S5a0eXPoc', title: 'React Native Tutorial for Beginners', channel: 'Programming with Mosh' },
      { id: 'VPvVD8t02U8', title: 'Flutter Course for Beginners', channel: 'freeCodeCamp' },
    ]
  },
  {
    id: 'ai-ml',
    label: 'AI & Machine Learning',
    topics: [
      { title: 'Python for AI', description: 'Python fundamentals for AI development', difficulty: 'beginner' },
      { title: 'Machine Learning Basics', description: 'Introduction to ML concepts', difficulty: 'intermediate' },
      { title: 'Deep Learning with TensorFlow', description: 'Build neural networks', difficulty: 'advanced' },
      { title: 'LLMs and Prompt Engineering', description: 'Work with large language models', difficulty: 'intermediate' },
    ],
    videos: [
      { id: 'rfscVS0vtbw', title: 'Python Tutorial Full Course', channel: 'freeCodeCamp' },
      { id: 'i_LwzRVP7bg', title: 'Machine Learning Crash Course', channel: 'Google Developers' },
    ]
  },
  {
    id: 'cloud',
    label: 'Cloud & DevOps',
    topics: [
      { title: 'AWS Fundamentals', description: 'Introduction to Amazon Web Services', difficulty: 'beginner' },
      { title: 'Docker Essentials', description: 'Containerize your applications', difficulty: 'intermediate' },
      { title: 'Kubernetes Basics', description: 'Orchestrate containers at scale', difficulty: 'advanced' },
      { title: 'CI/CD Pipelines', description: 'Automate your deployments', difficulty: 'intermediate' },
    ],
    videos: [
      { id: 'ulprqHHWlng', title: 'AWS Tutorial for Beginners', channel: 'Simplilearn' },
      { id: 'gAkwW2tuIqE', title: 'Docker Crash Course', channel: 'Fireship' },
    ]
  },
  {
    id: 'data-science',
    label: 'Data Science',
    topics: [
      { title: 'SQL Fundamentals', description: 'Query and manage databases', difficulty: 'beginner' },
      { title: 'Data Analysis with Pandas', description: 'Analyze data with Python', difficulty: 'intermediate' },
      { title: 'Data Visualization', description: 'Create compelling visualizations', difficulty: 'intermediate' },
    ],
    videos: [
      { id: 'HXV3zeQKqGY', title: 'SQL Full Course', channel: 'freeCodeCamp' },
      { id: 'vmEHCJofslg', title: 'Pandas Tutorial', channel: 'Keith Galli' },
    ]
  },
  {
    id: 'cybersecurity',
    label: 'Cybersecurity',
    topics: [
      { title: 'Security Fundamentals', description: 'Basics of cybersecurity', difficulty: 'beginner' },
      { title: 'Ethical Hacking', description: 'Learn penetration testing', difficulty: 'intermediate' },
      { title: 'Network Security', description: 'Secure network infrastructure', difficulty: 'advanced' },
    ],
    videos: [
      { id: 'hXSFdwIOfnE', title: 'Cybersecurity Full Course', channel: 'edureka!' },
    ]
  },
];

// Trending topics curated by FeedAI
const trendingTopics = [
  { title: 'Building AI Apps with Lovable', description: 'Learn to create AI-powered applications quickly', hot: true },
  { title: 'Prompt Engineering Mastery', description: 'Get the most out of AI assistants', hot: true },
  { title: 'TypeScript Best Practices 2024', description: 'Modern TypeScript patterns', hot: false },
  { title: 'Supabase for Full Stack', description: 'Backend development simplified', hot: true },
  { title: 'React Server Components', description: 'The future of React development', hot: false },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, category, query } = await req.json();

    if (action === 'get-categories') {
      return new Response(
        JSON.stringify({ 
          categories: techCategories.map(c => ({ id: c.id, label: c.label })),
          trending: trendingTopics,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'get-category-content') {
      const categoryData = techCategories.find(c => c.id === category);
      if (!categoryData) {
        return new Response(
          JSON.stringify({ error: 'Category not found' }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify(categoryData),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'ask-feedai') {
      // Use Lovable AI to answer tech questions
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY is not configured");
      }

      const systemPrompt = `You are FeedAI, feedin's AI assistant helping users learn technology. 
      You're an expert tech educator who explains concepts clearly and concisely.
      - Always identify as FeedAI, created by feedin
      - Never mention Google, OpenAI, or other AI companies
      - Be encouraging and supportive of learners
      - Provide practical examples when possible
      - Keep answers focused and educational`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query }
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error("AI service error");
      }

      const aiResponse = await response.json();
      const answer = aiResponse.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";

      return new Response(
        JSON.stringify({ answer }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Learn tech error:", error);
    return new Response(
      JSON.stringify({ error: "Service temporarily unavailable" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
