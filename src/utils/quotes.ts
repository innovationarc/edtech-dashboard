interface Quote {
  text: string;
  author: string;
  category: 'motivation' | 'learning' | 'success' | 'wisdom' | 'education';
}

const quotes: Quote[] = [
  // Motivational quotes
  {
    text: "The future belongs to those who believe in the beauty of their dreams.",
    author: "Eleanor Roosevelt",
    category: "motivation"
  },
  {
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill",
    category: "motivation"
  },
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
    category: "motivation"
  },
  {
    text: "Believe you can and you're halfway there.",
    author: "Theodore Roosevelt",
    category: "motivation"
  },
  {
    text: "Don't watch the clock; do what it does. Keep going.",
    author: "Sam Levenson",
    category: "motivation"
  },

  // Learning quotes
  {
    text: "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela",
    category: "education"
  },
  {
    text: "The beautiful thing about learning is that no one can take it away from you.",
    author: "B.B. King",
    category: "learning"
  },
  {
    text: "Learning never exhausts the mind.",
    author: "Leonardo da Vinci",
    category: "learning"
  },
  {
    text: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.",
    author: "Dr. Seuss",
    category: "learning"
  },
  {
    text: "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    author: "Mahatma Gandhi",
    category: "learning"
  },

  // Success quotes
  {
    text: "Success is not the key to happiness. Happiness is the key to success.",
    author: "Albert Schweitzer",
    category: "success"
  },
  {
    text: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney",
    category: "success"
  },
  {
    text: "Innovation distinguishes between a leader and a follower.",
    author: "Steve Jobs",
    category: "success"
  },
  {
    text: "Success is walking from failure to failure with no loss of enthusiasm.",
    author: "Winston Churchill",
    category: "success"
  },
  {
    text: "The only impossible journey is the one you never begin.",
    author: "Tony Robbins",
    category: "success"
  },

  // Wisdom quotes
  {
    text: "The only true wisdom is in knowing you know nothing.",
    author: "Socrates",
    category: "wisdom"
  },
  {
    text: "In the middle of difficulty lies opportunity.",
    author: "Albert Einstein",
    category: "wisdom"
  },
  {
    text: "It does not matter how slowly you go as long as you do not stop.",
    author: "Confucius",
    category: "wisdom"
  },
  {
    text: "The journey of a thousand miles begins with one step.",
    author: "Lao Tzu",
    category: "wisdom"
  },
  {
    text: "Yesterday is history, tomorrow is a mystery, today is a gift.",
    author: "Eleanor Roosevelt",
    category: "wisdom"
  },

  // Education-specific quotes
  {
    text: "Education is not preparation for life; education is life itself.",
    author: "John Dewey",
    category: "education"
  },
  {
    text: "The function of education is to teach one to think intensively and to think critically.",
    author: "Martin Luther King Jr.",
    category: "education"
  },
  {
    text: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.",
    author: "Malcolm X",
    category: "education"
  },
  {
    text: "An investment in knowledge pays the best interest.",
    author: "Benjamin Franklin",
    category: "education"
  },
  {
    text: "The roots of education are bitter, but the fruit is sweet.",
    author: "Aristotle",
    category: "education"
  },

  // Additional motivational quotes
  {
    text: "Your limitation—it's only your imagination.",
    author: "Unknown",
    category: "motivation"
  },
  {
    text: "Push yourself, because no one else is going to do it for you.",
    author: "Unknown",
    category: "motivation"
  },
  {
    text: "Great things never come from comfort zones.",
    author: "Unknown",
    category: "motivation"
  },
  {
    text: "Dream it. Wish it. Do it.",
    author: "Unknown",
    category: "motivation"
  },
  {
    text: "Success doesn't just find you. You have to go out and get it.",
    author: "Unknown",
    category: "success"
  },

  // Learning and growth quotes
  {
    text: "The expert in anything was once a beginner.",
    author: "Helen Hayes",
    category: "learning"
  },
  {
    text: "Learning is a treasure that will follow its owner everywhere.",
    author: "Chinese Proverb",
    category: "learning"
  },
  {
    text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.",
    author: "Brian Herbert",
    category: "learning"
  },
  {
    text: "Education is not the filling of a pail, but the lighting of a fire.",
    author: "William Butler Yeats",
    category: "education"
  },
  {
    text: "The mind is not a vessel to be filled, but a fire to be kindled.",
    author: "Plutarch",
    category: "education"
  }
];

export const getRandomQuote = (): Quote => {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
};

export const getRandomQuoteByCategory = (category: Quote['category']): Quote => {
  const categoryQuotes = quotes.filter(quote => quote.category === category);
  if (categoryQuotes.length === 0) {
    return getRandomQuote(); // Fallback to any random quote
  }
  const randomIndex = Math.floor(Math.random() * categoryQuotes.length);
  return categoryQuotes[randomIndex];
};

export const getAllCategories = (): Quote['category'][] => {
  return ['motivation', 'learning', 'success', 'wisdom', 'education'];
};