import { Clock, Star, BookOpen, GitMerge, Zap, Upload } from 'lucide-react';
import Card from '../components/ui/Card';

const ComingSoon = () => {
  const features = [
    {
      title: 'Advanced Analytics',
      description: 'Deeper insights into student performance with predictive analytics and machine learning.',
      icon: <Zap size={24} className="text-primary-400" />,
      progress: 70,
      comingSoon: 'Q2 2025',
    },
    {
      title: 'Interactive Assessments',
      description: 'Create interactive quizzes and assessments with rich media and instant feedback.',
      icon: <BookOpen size={24} className="text-secondary-400" />,
      progress: 85,
      comingSoon: 'Q1 2025',
    },
    {
      title: 'AI Content Generator',
      description: 'Generate course materials, quizzes, and study guides using advanced AI.',
      icon: <Star size={24} className="text-accent-400" />,
      progress: 40,
      comingSoon: 'Q3 2025',
    },
    {
      title: 'Mobile App',
      description: 'Native mobile applications for iOS and Android with offline content access.',
      icon: <Upload size={24} className="text-warning-DEFAULT" />,
      progress: 60,
      comingSoon: 'Q2 2025',
    },
    {
      title: 'Collaboration Tools',
      description: 'Real-time collaboration features for teachers and students working on group projects.',
      icon: <GitMerge size={24} className="text-error-DEFAULT" />,
      progress: 30,
      comingSoon: 'Q4 2025',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Coming Soon</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          We're constantly working to improve your experience. Check out these exciting features that are currently in development.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="p-0 transition-all duration-300 hover:shadow-card-hover">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-background-800 flex items-center justify-center flex-shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </div>
              </div>
              
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">Development Progress</span>
                  <span className="text-sm text-white">{feature.progress}%</span>
                </div>
                <div className="w-full bg-background-800 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-primary-500"
                    style={{ width: `${feature.progress}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="mt-6 flex items-center gap-2">
                <Clock size={16} className="text-primary-400" />
                <span className="text-sm text-primary-400">Expected: {feature.comingSoon}</span>
              </div>
            </div>
            
            <div className="p-4 border-t border-background-800 bg-card-dark">
              <button className="w-full bg-background-700 hover:bg-background-600 text-white py-2 rounded transition-colors">
                Request Early Access
              </button>
            </div>
          </Card>
        ))}
      </div>
      
      <div className="mt-12 bg-gradient-to-r from-primary-900 to-secondary-900 rounded-xl p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">Have a Feature Request?</h2>
        <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
          We value your input! If you have ideas for features that would make your experience better, we'd love to hear them.
        </p>
        <button className="bg-white text-primary-800 hover:bg-gray-100 font-medium py-2 px-6 rounded-lg transition-colors">
          Submit Feature Request
        </button>
      </div>
    </div>
  );
};

export default ComingSoon;