// src/services/userStatsService.ts
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface UserStats {
  userId: string;
  totalPoints: number;
  coursesCompleted: number;
  quizzesCompleted: number;
  perfectScores: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastCheckIn: Date;
  streakStartDate: Date;
  totalCheckIns: number;
  createdAt: Date;
  updatedAt: Date;
}

export const userStatsService = {
  // Initialize user stats when creating account
  async initializeUserStats(userId: string): Promise<void> {
    try {
      const statsRef = doc(db, 'user_stats', userId);
      const now = new Date();
      
      const initialStats: UserStats = {
        userId,
        totalPoints: 0,
        coursesCompleted: 0,
        quizzesCompleted: 0,
        perfectScores: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: now,
        createdAt: now,
        updatedAt: now
      };
      
      await setDoc(statsRef, {
        ...initialStats,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        lastActivityDate: Timestamp.fromDate(now)
      });
      
      console.log('✅ User stats initialized:', userId);
    } catch (error) {
      console.error('Error initializing user stats:', error);
      // Don't throw error - stats can be created later
    }
  },

  // Initialize user streak when creating account
  async initializeUserStreak(userId: string): Promise<void> {
    try {
      const streakRef = doc(db, 'user_streaks', userId);
      const now = new Date();
      
      const initialStreak: UserStreak = {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastCheckIn: now,
        streakStartDate: now,
        totalCheckIns: 0,
        createdAt: now,
        updatedAt: now
      };
      
      await setDoc(streakRef, {
        ...initialStreak,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        lastCheckIn: Timestamp.fromDate(now),
        streakStartDate: Timestamp.fromDate(now)
      });
      
      console.log('✅ User streak initialized:', userId);
    } catch (error) {
      console.error('Error initializing user streak:', error);
      // Don't throw error - streak can be created later
    }
  },

  // Get user stats with fallback to create if missing
  async getUserStats(userId: string): Promise<UserStats | null> {
    try {
      const statsRef = doc(db, 'user_stats', userId);
      const statsDoc = await getDoc(statsRef);
      
      if (!statsDoc.exists()) {
        // Create default stats if missing
        await this.initializeUserStats(userId);
        
        // Fetch again
        const newStatsDoc = await getDoc(statsRef);
        if (newStatsDoc.exists()) {
          const data = newStatsDoc.data();
          return {
            ...data,
            lastActivityDate: data.lastActivityDate?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          } as UserStats;
        }
        return null;
      }
      
      const data = statsDoc.data();
      return {
        ...data,
        lastActivityDate: data.lastActivityDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as UserStats;
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  },

  // Get user streak with fallback to create if missing
  async getUserStreak(userId: string): Promise<UserStreak | null> {
    try {
      const streakRef = doc(db, 'user_streaks', userId);
      const streakDoc = await getDoc(streakRef);
      
      if (!streakDoc.exists()) {
        // Create default streak if missing
        await this.initializeUserStreak(userId);
        
        // Fetch again
        const newStreakDoc = await getDoc(streakRef);
        if (newStreakDoc.exists()) {
          const data = newStreakDoc.data();
          return {
            ...data,
            lastCheckIn: data.lastCheckIn?.toDate() || new Date(),
            streakStartDate: data.streakStartDate?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          } as UserStreak;
        }
        return null;
      }
      
      const data = streakDoc.data();
      return {
        ...data,
        lastCheckIn: data.lastCheckIn?.toDate() || new Date(),
        streakStartDate: data.streakStartDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as UserStreak;
    } catch (error) {
      console.error('Error getting user streak:', error);
      return null;
    }
  },

  // Update user stats
  async updateUserStats(userId: string, updates: Partial<UserStats>): Promise<void> {
    try {
      const statsRef = doc(db, 'user_stats', userId);
      const now = new Date();
      
      await setDoc(statsRef, {
        ...updates,
        userId,
        updatedAt: Timestamp.fromDate(now)
      }, { merge: true });
      
      console.log('✅ User stats updated:', userId);
    } catch (error) {
      console.error('Error updating user stats:', error);
      throw error;
    }
  },

  // Update user streak
  async updateUserStreak(userId: string, updates: Partial<UserStreak>): Promise<void> {
    try {
      const streakRef = doc(db, 'user_streaks', userId);
      const now = new Date();
      
      await setDoc(streakRef, {
        ...updates,
        userId,
        updatedAt: Timestamp.fromDate(now)
      }, { merge: true });
      
      console.log('✅ User streak updated:', userId);
    } catch (error) {
      console.error('Error updating user streak:', error);
      throw error;
    }
  }
};
