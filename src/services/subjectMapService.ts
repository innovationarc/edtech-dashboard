// src/services/subjectMapService.ts
// Builds subject constellation map from student's content library and progress

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { contentLibraryService, LibraryContent, LibraryCourse, ContentNode } from './contentLibraryService';
import { contentProgressService, ContentProgress } from './contentProgressService';
import { attendanceService } from './liveClassService';

export interface TopicStar {
  id: string;
  name: string;
  contentId: string;
  mastered: boolean;
  progress: number;
  position: { x: number; y: number };
  contentType: 'lesson' | 'note' | 'trick' | 'exam';
}

export interface SubjectConstellation {
  id: string;
  name: string;
  color: string;
  stars: TopicStar[];
  overallProgress: number;
  totalContent: number;
  completedContent: number;
}

// Subject color mapping
const SUBJECT_COLORS: Record<string, string> = {
  'Mathematics': '#6366f1',
  'Math': '#6366f1',
  'Physics': '#8b5cf6',
  'Chemistry': '#ec4899',
  'Biology': '#10b981',
  'English': '#f59e0b',
  'Computer Science': '#06b6d4',
  'History': '#ef4444',
  'Geography': '#84cc16',
  'Economics': '#f97316',
  'Accounting': '#14b8a6',
  'Business Studies': '#8b5cf6',
};

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b',
  '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#14b8a6',
];

/**
 * Get color for a subject
 */
function getSubjectColor(subject: string, index: number): string {
  // Try exact match
  if (SUBJECT_COLORS[subject]) return SUBJECT_COLORS[subject];
  
  // Try partial match
  const normalized = subject.toLowerCase();
  for (const [key, color] of Object.entries(SUBJECT_COLORS)) {
    if (normalized.includes(key.toLowerCase())) return color;
  }
  
  // Use default color by index
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

/**
 * Generate random star positions in a constellation
 */
function generateStarPositions(count: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const minDistance = 15; // Minimum distance between stars
  
  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let position: { x: number; y: number };
    
    do {
      position = {
        x: 15 + Math.random() * 70, // 15-85% range
        y: 15 + Math.random() * 70, // 15-85% range
      };
      attempts++;
    } while (
      attempts < 50 &&
      positions.some(p => 
        Math.sqrt(Math.pow(p.x - position.x, 2) + Math.pow(p.y - position.y, 2)) < minDistance
      )
    );
    
    positions.push(position);
  }
  
  return positions;
}

/**
 * Recursively extract all content from content nodes.
 * Excludes notes and exams — constellation stars represent learning progress
 * (lessons and tricks only).
 */
function extractAllContent(nodes: ContentNode[]): LibraryContent[] {
  const content: LibraryContent[] = [];
  
  for (const node of nodes) {
    if (node.type === 'content' && node.contentData) {
      // Skip notes and exams — they don't represent study progress for constellation
      const t = node.contentData.type;
      if (t === 'note' || t === 'exam') continue;
      content.push(node.contentData);
    } else if (node.type === 'folder' && node.children) {
      content.push(...extractAllContent(node.children));
    }
  }
  
  return content;
}

/**
 * Check if content is completed from live class attendance
 * Content is counted as completed if student attended the live class for at least 70% of duration
 */
async function isContentCompletedFromLiveClass(
  contentId: string,
  studentId: string
): Promise<boolean> {
  try {
    // Get all live classes that have this contentId
    const classesQuery = query(
      collection(db, 'live_classes'),
      where('contentId', '==', contentId),
      where('status', '==', 'ended')
    );
    const classesSnap = await getDocs(classesQuery);
    
    if (classesSnap.empty) return false;
    
    // Check attendance for each class
    for (const classDoc of classesSnap.docs) {
      const classData = classDoc.data();
      const attendance = await attendanceService.getByClass(classDoc.id);
      
      const studentAttendance = attendance.find(a => a.userId === studentId);
      if (!studentAttendance || !studentAttendance.durationMins) continue;
      
      const classDuration = classData.actualDurationMins || classData.durationMins;
      if (!classDuration) continue;
      
      const attendancePercentage = (studentAttendance.durationMins / classDuration) * 100;
      
      // If student attended 70%+ of any linked class, mark as completed
      if (attendancePercentage >= 70) {
        return true;
      }
    }
    
    return false;
  } catch (err) {
    console.error('Error checking live class attendance:', err);
    return false;
  }
}

export const subjectMapService = {
  /**
   * Build subject constellation map for a student
   */
  async buildSubjectMap(studentId: string): Promise<SubjectConstellation[]> {
    // 1. Get all enrolled courses and their content
    const courses = await contentLibraryService.getStudentLibrary(studentId);
    
    // 2. Get all progress data for this student
    const progressData = await contentProgressService.getStudentProgress(studentId);
    
    // 3. Create progress lookup map
    const progressMap = new Map<string, ContentProgress>();
    for (const p of progressData) {
      progressMap.set(p.contentId, p);
    }
    
    // 4. Extract all content and group by subject
    const subjectMap = new Map<string, LibraryContent[]>();
    
    for (const course of courses) {
      const allContent = extractAllContent(course.contentStructure);
      
      for (const content of allContent) {
        if (!content.subject) continue;
        
        const subject = content.subject;
        if (!subjectMap.has(subject)) {
          subjectMap.set(subject, []);
        }
        subjectMap.get(subject)!.push(content);
      }
    }
    
    // 5. Build constellations
    const constellations: SubjectConstellation[] = [];
    let subjectIndex = 0;
    
    for (const [subject, contentList] of subjectMap.entries()) {
      // Group content by topic field only.
      // Content with no topic is skipped — it has no meaningful constellation placement.
      // Key is lowercased+trimmed for grouping (handles case/whitespace mismatches).
      // Display name uses the first original casing encountered for that key.
      const topicMap = new Map<string, LibraryContent[]>();
      const topicDisplayName = new Map<string, string>(); // key → original display name

      for (const content of contentList) {
        const rawTopic = (content.topic || '').trim();
        if (!rawTopic) continue; // skip content with no topic set
        const key = rawTopic.toLowerCase();
        if (!topicMap.has(key)) {
          topicMap.set(key, []);
          topicDisplayName.set(key, rawTopic);
        }
        topicMap.get(key)!.push(content);
      }
      
      // Generate star positions
      const starCount = topicMap.size;
      const positions = generateStarPositions(starCount);
      
      // Create stars - one star per topic
      const stars: TopicStar[] = [];
      let starIndex = 0;
      let totalProgress = 0;
      let completedCount = 0;
      
      for (const [topicKey, topicContents] of topicMap.entries()) {
        const topicName = topicDisplayName.get(topicKey) ?? topicKey;
        // CRITICAL: Calculate topic completion based on ALL content in this topic
        let completedContentCount = 0;
        let totalContentCount = topicContents.length;
        let totalTopicProgress = 0;
        
        for (const content of topicContents) {
          const progress = progressMap.get(content.id);
          
          if (progress) {
            // Use actual watchPercentage for the average.
            // Live-class auto-complete docs have isCompleted:true but no watchPercentage —
            // default to 100 only in that case.
            const pct = (progress.watchPercentage != null && progress.watchPercentage > 0)
              ? progress.watchPercentage
              : progress.isCompleted ? 100 : 0;
            totalTopicProgress += pct;
            if (progress.isCompleted || pct >= 70) {
              completedContentCount++;
            }
          } else {
            // No content_progress doc — check live class attendance directly
            try {
              const liveClassCompleted = await isContentCompletedFromLiveClass(
                content.id,
                studentId
              );
              if (liveClassCompleted) {
                completedContentCount++;
                totalTopicProgress += 100;
              }
            } catch (e) {
              console.error('[subjectMapService] live class check failed for', content.id, e);
            }
          }
        }
        
        // IMPORTANT: Topic progress = average of all content progress
        const topicProgress = totalContentCount > 0 
          ? Math.round(totalTopicProgress / totalContentCount)
          : 0;
        
        // IMPORTANT: Topic is mastered ONLY when ALL content in topic is completed
        const topicMastered = completedContentCount === totalContentCount && totalContentCount > 0;
        
        // Use first content item's ID as representative (for navigation)
        const primaryContent = topicContents[0];
        
        stars.push({
          id: primaryContent.id,
          name: topicName,
          contentId: primaryContent.id,
          mastered: topicMastered,
          progress: topicProgress,
          position: positions[starIndex],
          contentType: primaryContent.type,
        });
        
        totalProgress += topicProgress;
        if (topicMastered) completedCount++;
        
        starIndex++;
      }
      
      const overallProgress = stars.length > 0 
        ? Math.round(totalProgress / stars.length)
        : 0;
      
      constellations.push({
        id: subject,
        name: subject,
        color: getSubjectColor(subject, subjectIndex),
        stars,
        overallProgress,
        totalContent: stars.length,
        completedContent: completedCount,
      });
      
      subjectIndex++;
    }
    
    // Sort by name
    constellations.sort((a, b) => a.name.localeCompare(b.name));
    
    return constellations;
  },

  /**
   * Get summary statistics
   */
  async getSubjectMapStats(studentId: string): Promise<{
    totalSubjects: number;
    totalTopics: number;
    completedTopics: number;
    averageProgress: number;
  }> {
    const constellations = await subjectMapService.buildSubjectMap(studentId);
    
    const totalSubjects = constellations.length;
    const totalTopics = constellations.reduce((sum, c) => sum + c.totalContent, 0);
    const completedTopics = constellations.reduce((sum, c) => sum + c.completedContent, 0);
    const averageProgress = constellations.length > 0
      ? Math.round(
          constellations.reduce((sum, c) => sum + c.overallProgress, 0) / constellations.length
        )
      : 0;
    
    return {
      totalSubjects,
      totalTopics,
      completedTopics,
      averageProgress,
    };
  },
};
