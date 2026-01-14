import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  setDoc,
  deleteDoc, 
  query, 
  where,
  orderBy,
  limit,
  Timestamp,
  FieldValue
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'learning' | 'performance' | 'consistency' | 'social' | 'milestone';
  type: 'bronze' | 'silver' | 'gold' | 'platinum' | 'special';
  points: number;
  requirements: {
    type: 'mcq_streak' | 'course_completion' | 'study_days' | 'perfect_score' | 'time_spent' | 'custom';
    target: number;
    timeframe?: 'daily' | 'weekly' | 'monthly' | 'all_time';
    subject?: string;
  };
  isActive: boolean;
  createdAt: Date;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  achievementName: string;
  achievementIcon: string;
  achievementType: string;
  pointsEarned: number;
  unlockedAt: Date;
  progress?: number; // For tracking progress towards achievement
}

export interface UserStats {
  id: string;
  userId: string;
  totalPoints: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  totalStudyTime: number; // in minutes
  coursesCompleted: number;
  mcqsAnswered: number;
  mcqsCorrect: number;
  perfectScores: number;
  studyDays: number;
  lastActivityDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  icon: string;
  createdBy: string; // teacher ID
  createdByName: string;
  type: 'individual' | 'group' | 'class';
  category: string;
  startDate: Date;
  endDate: Date;
  requirements: {
    type: string;
    target: number;
    subject?: string;
  };
  rewards: {
    points: number;
    badge?: string;
    customReward?: string;
  };
  participants: string[]; // user IDs
  isActive: boolean;
  createdAt: Date;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  userAvatar: string;
  totalPoints: number;
  level: number;
  achievements: number;
  currentStreak: number;
  rank: number;
  weeklyPoints?: number;
  monthlyPoints?: number;
}

export const gamificationService = {
  // Achievement Management
  async createAchievement(achievement: Omit<Achievement, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'achievements'), {
        ...achievement,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getAllAchievements(): Promise<Achievement[]> {
    try {
      const achievementsCollection = collection(db, 'achievements');
      const achievementsSnapshot = await getDocs(
        query(achievementsCollection, where('isActive', '==', true), orderBy('points', 'asc'))
      );
      
      return achievementsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      })) as Achievement[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // User Stats Management
  async getUserStats(userId: string): Promise<UserStats | null> {
    try {
      const userStatsDoc = await getDoc(doc(db, 'userStats', userId));
      
      if (!userStatsDoc.exists()) {
        // Create initial stats for new user
        const initialStats: Omit<UserStats, 'id'> = {
          userId,
          totalPoints: 0,
          level: 1,
          currentStreak: 0,
          longestStreak: 0,
          totalStudyTime: 0,
          coursesCompleted: 0,
          mcqsAnswered: 0,
          mcqsCorrect: 0,
          perfectScores: 0,
          studyDays: 0,
          lastActivityDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await this.updateUserStats(userId, initialStats);
        return { id: userId, ...initialStats };
      }
      
      const statsData = userStatsDoc.data();
      return {
        id: userStatsDoc.id,
        ...statsData,
        lastActivityDate: statsData.lastActivityDate.toDate(),
        createdAt: statsData.createdAt.toDate(),
        updatedAt: statsData.updatedAt.toDate()
      } as UserStats;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async updateUserStats(userId: string, updates: Partial<UserStats>): Promise<void> {
    try {
      const userStatsRef = doc(db, 'userStats', userId);
      const updateData = { ...updates };
      
      // Convert dates to Timestamps
      if (updateData.lastActivityDate) {
        updateData.lastActivityDate = Timestamp.fromDate(updateData.lastActivityDate) as any;
      }
      if (updateData.createdAt) {
        updateData.createdAt = Timestamp.fromDate(updateData.createdAt) as any;
      }
      
      await setDoc(userStatsRef, {
        ...updateData,
        updatedAt: Timestamp.now()
      }, { merge: true });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Award points and check for achievements
  async awardPoints(userId: string, points: number, activity: string): Promise<UserAchievement[]> {
    try {
      const userStats = await this.getUserStats(userId);
      if (!userStats) return [];

      // Update user stats
      const newTotalPoints = userStats.totalPoints + points;
      const newLevel = Math.floor(newTotalPoints / 1000) + 1; // 1000 points per level
      
      await this.updateUserStats(userId, {
        totalPoints: newTotalPoints,
        level: newLevel,
        lastActivityDate: new Date()
      });

      // Check for new achievements
      const newAchievements = await this.checkAchievements(userId, userStats);
      
      return newAchievements;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Check and unlock achievements
  async checkAchievements(userId: string, userStats: UserStats): Promise<UserAchievement[]> {
    try {
      const achievements = await this.getAllAchievements();
      const userAchievements = await this.getUserAchievements(userId);
      const unlockedAchievementIds = userAchievements.map(ua => ua.achievementId);
      
      const newAchievements: UserAchievement[] = [];
      
      for (const achievement of achievements) {
        if (unlockedAchievementIds.includes(achievement.id)) continue;
        
        let isUnlocked = false;
        
        switch (achievement.requirements.type) {
          case 'mcq_streak':
            isUnlocked = userStats.currentStreak >= achievement.requirements.target;
            break;
          case 'course_completion':
            isUnlocked = userStats.coursesCompleted >= achievement.requirements.target;
            break;
          case 'study_days':
            isUnlocked = userStats.studyDays >= achievement.requirements.target;
            break;
          case 'perfect_score':
            isUnlocked = userStats.perfectScores >= achievement.requirements.target;
            break;
          case 'time_spent':
            isUnlocked = userStats.totalStudyTime >= achievement.requirements.target;
            break;
        }
        
        if (isUnlocked) {
          const userAchievement = await this.unlockAchievement(userId, achievement);
          newAchievements.push(userAchievement);
        }
      }
      
      return newAchievements;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async unlockAchievement(userId: string, achievement: Achievement): Promise<UserAchievement> {
    try {
      const userAchievement: Omit<UserAchievement, 'id'> = {
        userId,
        achievementId: achievement.id,
        achievementName: achievement.name,
        achievementIcon: achievement.icon,
        achievementType: achievement.type,
        pointsEarned: achievement.points,
        unlockedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'userAchievements'), {
        ...userAchievement,
        unlockedAt: Timestamp.now()
      });
      
      // Award points for the achievement
      await this.awardPoints(userId, achievement.points, `Achievement: ${achievement.name}`);
      
      return { id: docRef.id, ...userAchievement };
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      const userAchievementsCollection = collection(db, 'userAchievements');
      const userAchievementsSnapshot = await getDocs(
        query(userAchievementsCollection, where('userId', '==', userId), orderBy('unlockedAt', 'desc'))
      );
      
      return userAchievementsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        unlockedAt: doc.data().unlockedAt.toDate()
      })) as UserAchievement[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Leaderboard
  async getLeaderboard(timeframe: 'all_time' | 'weekly' | 'monthly' = 'all_time', limit_count: number = 50): Promise<LeaderboardEntry[]> {
    try {
      const userStatsCollection = collection(db, 'userStats');
      const userStatsSnapshot = await getDocs(
        query(userStatsCollection, orderBy('totalPoints', 'desc'), limit(limit_count))
      );
      
      const leaderboardEntries: LeaderboardEntry[] = [];
      
      for (let i = 0; i < userStatsSnapshot.docs.length; i++) {
        const doc = userStatsSnapshot.docs[i];
        const statsData = doc.data();
        
        // Get user achievements count
        const userAchievements = await this.getUserAchievements(doc.id);
        
        leaderboardEntries.push({
          userId: doc.id,
          userName: statsData.userName || 'Unknown User',
          userAvatar: statsData.userAvatar || statsData.userName?.charAt(0) || 'U',
          totalPoints: statsData.totalPoints,
          level: statsData.level,
          achievements: userAchievements.length,
          currentStreak: statsData.currentStreak,
          rank: i + 1
        });
      }
      
      return leaderboardEntries;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Challenge Management
  async createChallenge(challenge: Omit<Challenge, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'challenges'), {
        ...challenge,
        startDate: Timestamp.fromDate(challenge.startDate),
        endDate: Timestamp.fromDate(challenge.endDate),
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getActiveChallenges(): Promise<Challenge[]> {
    try {
      const challengesCollection = collection(db, 'challenges');
      const now = Timestamp.now();
      
      const challengesSnapshot = await getDocs(
        query(
          challengesCollection, 
          where('isActive', '==', true),
          where('endDate', '>', now),
          orderBy('endDate', 'asc')
        )
      );
      
      return challengesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate.toDate(),
        endDate: doc.data().endDate.toDate(),
        createdAt: doc.data().createdAt.toDate()
      })) as Challenge[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async joinChallenge(challengeId: string, userId: string): Promise<void> {
    try {
      const challengeRef = doc(db, 'challenges', challengeId);
      const challengeDoc = await getDoc(challengeRef);
      
      if (challengeDoc.exists()) {
        const challengeData = challengeDoc.data();
        const participants = challengeData.participants || [];
        
        if (!participants.includes(userId)) {
          participants.push(userId);
          await updateDoc(challengeRef, { participants });
        }
      }
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Activity tracking
  async recordActivity(userId: string, activityType: string, data: any): Promise<void> {
    try {
      const userStats = await this.getUserStats(userId);
      if (!userStats) return;

      let pointsToAward = 0;
      const updates: Partial<UserStats> = {};

      switch (activityType) {
        case 'mcq_completed':
          updates.mcqsAnswered = FieldValue.increment(1) as any;
          if (data.isCorrect) {
            updates.mcqsCorrect = FieldValue.increment(1) as any;
            pointsToAward = 10;
          }
          if (data.isPerfectScore) {
            updates.perfectScores = FieldValue.increment(1) as any;
            pointsToAward += 50;
          }
          break;
          
        case 'course_completed':
          updates.coursesCompleted = FieldValue.increment(1) as any;
          pointsToAward = 500;
          break;
          
        case 'study_session':
          updates.totalStudyTime = FieldValue.increment(data.duration || 0) as any;
          // Check if it's a new day for study streak
          const today = new Date();
          const lastActivity = userStats.lastActivityDate;
          if (lastActivity.toDateString() !== today.toDateString()) {
            updates.studyDays = FieldValue.increment(1) as any;
            // Streak logic will be handled in DashboardContext
          }
          updates.lastActivityDate = Timestamp.now() as any;
          pointsToAward = Math.floor((data.duration || 0) / 10); // 1 point per 10 minutes
          break;
          
        case 'streak_updated':
          updates.currentStreak = data.newStreak;
          if (data.newStreak > (userStats.longestStreak || 0)) {
            updates.longestStreak = data.newStreak;
          }
          updates.lastActivityDate = Timestamp.now() as any;
          pointsToAward = data.newStreak * 5; // 5 points per day in streak
          break;
          
        case 'task_completed':
          // Award points based on the grade received
          pointsToAward = data.grade || 0; // Assuming data.grade is passed
          // You might also want to track total tasks completed, average grade, etc.
          // updates.tasksCompleted = FieldValue.increment(1) as any;
          break;
      }

      if (Object.keys(updates).length > 0) {
        const userStatsRef = doc(db, 'userStats', userId);
        await updateDoc(userStatsRef, {
          ...updates,
          updatedAt: Timestamp.now()
        });
      }

      if (pointsToAward > 0) {
        await this.awardPoints(userId, pointsToAward, activityType);
      }
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
};

