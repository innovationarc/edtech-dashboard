import { useState, useEffect } from 'react';
import { 
  Trophy, 
  Star, 
  Award, 
  Target, 
  Zap, 
  Calendar,
  Users,
  TrendingUp,
  Medal,
  Crown,
  Flame,
  BookOpen,
  Brain,
  Clock,
  Loader,
  Lock,
  CheckCircle
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { 
  gamificationService, 
  Achievement, 
  UserAchievement, 
  UserStats, 
  Challenge,
  LeaderboardEntry 
} from '../services/gamificationService';

const Achievements = () => {
  const { user } = useDashboard();
  const [activeTab, setActiveTab] = useState<'achievements' | 'leaderboard' | 'challenges'>('achievements');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError('');
      
      const [
        achievementsData,
        userAchievementsData,
        userStatsData,
        leaderboardData,
        challengesData
      ] = await Promise.all([
        gamificationService.getAllAchievements(),
        gamificationService.getUserAchievements(user.uid),
        gamificationService.getUserStats(user.uid),
        gamificationService.getLeaderboard('all_time', 20),
        gamificationService.getActiveChallenges()
      ]);
      
      setAchievements(achievementsData);
      setUserAchievements(userAchievementsData);
      setUserStats(userStatsData);
      setLeaderboard(leaderboardData);
      setChallenges(challengesData);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getAchievementIcon = (iconName: string) => {
    const iconMap: Record<string, JSX.Element> = {
      'trophy': <Trophy size={24} className="text-yellow-400" />,
      'star': <Star size={24} className="text-yellow-400" />,
      'award': <Award size={24} className="text-yellow-400" />,
      'target': <Target size={24} className="text-blue-400" />,
      'zap': <Zap size={24} className="text-purple-400" />,
      'flame': <Flame size={24} className="text-orange-400" />,
      'book': <BookOpen size={24} className="text-green-400" />,
      'brain': <Brain size={24} className="text-pink-400" />,
      'clock': <Clock size={24} className="text-indigo-400" />,
      'medal': <Medal size={24} className="text-yellow-400" />,
      'crown': <Crown size={24} className="text-yellow-400" />
    };
    return iconMap[iconName] || <Award size={24} className="text-gray-400" />;
  };

  const getAchievementTypeColor = (type: string) => {
    switch (type) {
      case 'bronze': return 'from-amber-700 to-amber-500';
      case 'silver': return 'from-gray-400 to-gray-200';
      case 'gold': return 'from-yellow-500 to-yellow-300';
      case 'platinum': return 'from-purple-500 to-purple-300';
      case 'special': return 'from-pink-500 to-pink-300';
      default: return 'from-gray-600 to-gray-400';
    }
  };

  const isAchievementUnlocked = (achievementId: string) => {
    return userAchievements.some(ua => ua.achievementId === achievementId);
  };

  const getProgressTowardsAchievement = (achievement: Achievement) => {
    if (!userStats) return 0;
    
    switch (achievement.requirements.type) {
      case 'mcq_streak':
        return Math.min((userStats.currentStreak / achievement.requirements.target) * 100, 100);
      case 'course_completion':
        return Math.min((userStats.coursesCompleted / achievement.requirements.target) * 100, 100);
      case 'study_days':
        return Math.min((userStats.studyDays / achievement.requirements.target) * 100, 100);
      case 'perfect_score':
        return Math.min((userStats.perfectScores / achievement.requirements.target) * 100, 100);
      case 'time_spent':
        return Math.min((userStats.totalStudyTime / achievement.requirements.target) * 100, 100);
      default:
        return 0;
    }
  };

  const joinChallenge = async (challengeId: string) => {
    if (!user) return;
    
    try {
      await gamificationService.joinChallenge(challengeId, user.uid);
      await loadData(); // Refresh data
    } catch (error: any) {
      console.error('Error joining challenge:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Trophy size={48} className="mx-auto text-gray-500 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Error Loading Achievements</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={loadData}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Achievements & Gamification</h1>
          <p className="text-gray-400 mt-1">Track your progress and compete with others</p>
        </div>
        
        {userStats && (
          <div className="text-right">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{userStats.totalPoints}</div>
                <div className="text-xs text-gray-400">Total Points</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-400">Level {userStats.level}</div>
                <div className="text-xs text-gray-400">Current Level</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">{userStats.currentStreak}</div>
                <div className="text-xs text-gray-400">Day Streak</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-background-800">
        <div className="flex gap-6">
          {[
            { id: 'achievements', label: 'Achievements', icon: <Trophy size={18} /> },
            { id: 'leaderboard', label: 'Leaderboard', icon: <TrendingUp size={18} /> },
            { id: 'challenges', label: 'Challenges', icon: <Target size={18} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'achievements' && (
        <div className="space-y-6">
          {/* User Progress Overview */}
          {userStats && (
            <Card title="Your Progress" className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-300 flex items-center justify-center mx-auto mb-2">
                    <Brain size={24} className="text-white" />
                  </div>
                  <div className="text-lg font-bold text-white">{userStats.mcqsCorrect}/{userStats.mcqsAnswered}</div>
                  <div className="text-xs text-gray-400">MCQs Correct</div>
                </div>
                
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-green-500 to-green-300 flex items-center justify-center mx-auto mb-2">
                    <BookOpen size={24} className="text-white" />
                  </div>
                  <div className="text-lg font-bold text-white">{userStats.coursesCompleted}</div>
                  <div className="text-xs text-gray-400">Courses Completed</div>
                </div>
                
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-300 flex items-center justify-center mx-auto mb-2">
                    <Clock size={24} className="text-white" />
                  </div>
                  <div className="text-lg font-bold text-white">{Math.floor(userStats.totalStudyTime / 60)}h</div>
                  <div className="text-xs text-gray-400">Study Time</div>
                </div>
                
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-300 flex items-center justify-center mx-auto mb-2">
                    <Flame size={24} className="text-white" />
                  </div>
                  <div className="text-lg font-bold text-white">{userStats.longestStreak}</div>
                  <div className="text-xs text-gray-400">Longest Streak</div>
                </div>
              </div>
            </Card>
          )}

          {/* Achievements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {achievements.map(achievement => {
              const isUnlocked = isAchievementUnlocked(achievement.id);
              const progress = getProgressTowardsAchievement(achievement);
              
              return (
                <Card key={achievement.id} className="p-0 overflow-hidden">
                  <div className={`h-2 bg-gradient-to-r ${getAchievementTypeColor(achievement.type)}`}></div>
                  
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${getAchievementTypeColor(achievement.type)} flex items-center justify-center flex-shrink-0 ${!isUnlocked && 'opacity-50'}`}>
                        {isUnlocked ? (
                          getAchievementIcon(achievement.icon)
                        ) : (
                          <Lock size={24} className="text-white" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                            {achievement.name}
                          </h3>
                          {isUnlocked && (
                            <CheckCircle size={16} className="text-success-DEFAULT" />
                          )}
                        </div>
                        
                        <p className={`text-sm mb-3 ${isUnlocked ? 'text-gray-300' : 'text-gray-500'}`}>
                          {achievement.description}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className={`px-2 py-1 rounded-full ${isUnlocked ? 'bg-success-dark text-success-light' : 'bg-background-700 text-gray-400'}`}>
                            {achievement.points} points
                          </span>
                          <span className={`capitalize ${isUnlocked ? 'text-primary-400' : 'text-gray-500'}`}>
                            {achievement.type}
                          </span>
                        </div>
                        
                        {!isUnlocked && progress > 0 && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">Progress</span>
                              <span className="text-white">{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full bg-background-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full bg-gradient-to-r ${getAchievementTypeColor(achievement.type)}`}
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <Card title="Global Leaderboard" subtitle="Top performers across the platform">
          <div className="space-y-4">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.userId}
                className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                  entry.userId === user?.uid ? 'bg-primary-900/20 border border-primary-500/30' : 'bg-background-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold ${
                    index === 0 ? 'bg-yellow-500 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    index === 2 ? 'bg-amber-600 text-white' :
                    'bg-background-700 text-gray-300'
                  }`}>
                    {index < 3 ? (
                      index === 0 ? <Crown size={16} /> :
                      index === 1 ? <Medal size={16} /> :
                      <Award size={16} />
                    ) : (
                      entry.rank
                    )}
                  </div>
                  
                  <div className="h-10 w-10 rounded-full bg-primary-700 flex items-center justify-center">
                    <span className="text-white font-medium">{entry.userAvatar}</span>
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium truncate">{entry.userName}</h3>
                    {entry.userId === user?.uid && (
                      <span className="text-xs bg-primary-900 text-primary-300 px-2 py-0.5 rounded">You</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>Level {entry.level}</span>
                    <span>{entry.achievements} achievements</span>
                    <span>{entry.currentStreak} day streak</span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold text-yellow-400">{entry.totalPoints}</div>
                  <div className="text-xs text-gray-400">points</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'challenges' && (
        <div className="space-y-6">
          <Card title="Active Challenges" subtitle="Join challenges to earn extra points and rewards">
            <div className="space-y-4">
              {challenges.length === 0 ? (
                <div className="text-center py-8">
                  <Target size={48} className="mx-auto text-gray-500 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Active Challenges</h3>
                  <p className="text-gray-400">Check back later for new challenges from your teachers!</p>
                </div>
              ) : (
                challenges.map(challenge => {
                  const isParticipating = challenge.participants.includes(user?.uid || '');
                  const daysLeft = Math.ceil((challenge.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <div key={challenge.id} className="p-4 bg-background-800 rounded-lg border-l-4 border-primary-500">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-primary-600 flex items-center justify-center">
                            <Target size={20} className="text-white" />
                          </div>
                          <div>
                            <h3 className="text-white font-medium">{challenge.name}</h3>
                            <p className="text-sm text-gray-400">by {challenge.createdByName}</p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm text-primary-400 font-medium">
                            {challenge.rewards.points} points
                          </div>
                          <div className="text-xs text-gray-400">
                            {daysLeft} days left
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-gray-300 text-sm mb-4">{challenge.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Users size={14} />
                            {challenge.participants.length} participants
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            Ends {challenge.endDate.toLocaleDateString()}
                          </span>
                        </div>
                        
                        {isParticipating ? (
                          <span className="px-3 py-1 bg-success-dark text-success-light rounded-full text-sm">
                            Participating
                          </span>
                        ) : (
                          <button
                            onClick={() => joinChallenge(challenge.id)}
                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm transition-colors"
                          >
                            Join Challenge
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Achievements;
