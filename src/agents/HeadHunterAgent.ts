import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

/**
 * Candidate CV Data Model
 */
interface CandidateCV {
  name: string;
  email: string;
  phone?: string;
  experience: number; // years
  skills: string[];
  education: Array<{
    degree: string;
    field: string;
    institution: string;
    year: number;
  }>;
  languages: Array<{
    language: string;
    proficiency: 'basic' | 'intermediate' | 'fluent' | 'native';
  }>;
  certifications: string[];
  previousRoles: Array<{
    title: string;
    company: string;
    duration: number; // months
    responsibilities: string[];
  }>;
}

/**
 * Job Position Requirements
 */
interface JobRequirement {
  title: string;
  requiredSkills: string[];
  minExperience: number; // years
  requiredDegree?: string;
  keyLanguages?: string[];
  preferredCertifications?: string[];
}

/**
 * Candidate Assessment Result
 */
interface CandidateAssessment {
  candidateName: string;
  jobMatch: number; // 0-100
  skillsMatch: string[];
  experienceMatch: boolean;
  educationMatch: boolean;
  languageMatch: boolean;
  strengths: string[];
  gaps: string[];
  recommendedQuestions: string[];
  overallRecommendation: 'strong' | 'suitable' | 'consider' | 'pass';
}

/**
 * HeadHunterAgent - Digitális Fejvadász
 * Processes CVs, filters candidates, generates interview questions
 */
export class HeadHunterAgent implements IAgent {
  name = 'HeadHunter';
  role = 'HR Talent Acquisition';
  description = 'Digitális Fejvadász - CV feldolgozás, jelölt szűrés, interjúkérdések generálása';
  capabilities = [
    'CV parsing and extraction',
    'Candidate-job matching',
    'Interview question generation',
    'Skill gap analysis',
    'Talent pool management'
  ];

  private cvDatabase: Map<string, CandidateCV> = new Map();
  private assessmentHistory: CandidateAssessment[] = [];

  /**
   * Execute agent task
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      logInfo(this.name, `Feladat indítása: ${task.slice(0, 40)}...`);

      if (task.toLowerCase().includes('parse') || task.toLowerCase().includes('cv')) {
        return await this.parseAndStoreCV(task, context);
      }

      if (task.toLowerCase().includes('match') || task.toLowerCase().includes('szűr')) {
        return await this.evaluateCandidates(task, context);
      }

      if (task.toLowerCase().includes('interview') || task.toLowerCase().includes('kérdés')) {
        return await this.generateInterviewQuestions(task, context);
      }

      // Default: evaluate candidates
      return await this.evaluateCandidates(task, context);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Parse and store CV data
   */
  private async parseAndStoreCV(task: string, context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'CV feldolgozás indítása...');

    // Simulated CV parsing (in production, would use OCR + NLP)
    const mockCVs: CandidateCV[] = [
      {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        phone: '+1-555-0001',
        experience: 8,
        skills: ['Python', 'TypeScript', 'React', 'Machine Learning', 'SQL', 'AWS'],
        education: [
          {
            degree: 'B.S.',
            field: 'Computer Science',
            institution: 'Stanford University',
            year: 2015
          },
          {
            degree: 'M.S.',
            field: 'AI/ML',
            institution: 'MIT',
            year: 2017
          }
        ],
        languages: [
          { language: 'English', proficiency: 'native' },
          { language: 'German', proficiency: 'fluent' }
        ],
        certifications: ['AWS Solutions Architect', 'Google Cloud Professional'],
        previousRoles: [
          {
            title: 'Senior Software Engineer',
            company: 'Google',
            duration: 36,
            responsibilities: [
              'Led ML systems design',
              'Mentored junior engineers',
              'Contributed to TensorFlow'
            ]
          },
          {
            title: 'Data Scientist',
            company: 'McKinsey',
            duration: 24,
            responsibilities: [
              'Built predictive models',
              'Client presentations',
              'Team leadership'
            ]
          }
        ]
      },
      {
        name: 'Bob Smith',
        email: 'bob@example.com',
        experience: 5,
        skills: ['Java', 'React', 'SQL', 'Docker'],
        education: [
          {
            degree: 'B.S.',
            field: 'Information Technology',
            institution: 'University of Texas',
            year: 2018
          }
        ],
        languages: [{ language: 'English', proficiency: 'native' }],
        certifications: ['AWS Developer Associate'],
        previousRoles: [
          {
            title: 'Software Developer',
            company: 'Microsoft',
            duration: 24,
            responsibilities: ['Backend development', 'API design']
          },
          {
            title: 'Junior Developer',
            company: 'StartUp XYZ',
            duration: 18,
            responsibilities: ['Full-stack development']
          }
        ]
      }
    ];

    // Store CVs
    for (const cv of mockCVs) {
      this.cvDatabase.set(cv.name.toLowerCase(), cv);
      logInfo(this.name, `CV feldolgozva: ${cv.name} (${cv.experience} év tapasztalat)`);
    }

    return {
      status: 'success',
      data: {
        processedCount: mockCVs.length,
        candidates: mockCVs.map(cv => ({
          name: cv.name,
          experience: cv.experience,
          topSkills: cv.skills.slice(0, 3),
          education: cv.education.map(e => e.degree).join(', ')
        }))
      }
    };
  }

  /**
   * Evaluate candidates against job requirements
   */
  private async evaluateCandidates(task: string, context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Jelölt kiértékelés indítása...');

    // Mock job requirement
    const jobReq: JobRequirement = {
      title: 'Senior Full-Stack Engineer',
      requiredSkills: ['TypeScript', 'React', 'Python', 'AWS', 'SQL'],
      minExperience: 5,
      requiredDegree: 'B.S.',
      keyLanguages: ['English'],
      preferredCertifications: ['AWS Solutions Architect']
    };

    const assessments: CandidateAssessment[] = [];

    // Evaluate each candidate in database
    for (const [_, cv] of this.cvDatabase) {
      const assessment = this.assessCandidate(cv, jobReq);
      assessments.push(assessment);
      this.assessmentHistory.push(assessment);

      logInfo(
        this.name,
        `${cv.name} kiértékelve: ${assessment.jobMatch}% match (${assessment.overallRecommendation})`
      );
    }

    // Sort by match score
    assessments.sort((a, b) => b.jobMatch - a.jobMatch);

    return {
      status: 'success',
      data: {
        jobTitle: jobReq.title,
        evaluatedCount: assessments.length,
        topCandidates: assessments.slice(0, 3).map(a => ({
          name: a.candidateName,
          matchScore: a.jobMatch,
          recommendation: a.overallRecommendation,
          strengths: a.strengths,
          gaps: a.gaps
        })),
        assessments
      }
    };
  }

  /**
   * Assess individual candidate
   */
  private assessCandidate(cv: CandidateCV, job: JobRequirement): CandidateAssessment {
    const skillsMatch = cv.skills.filter(s => 
      job.requiredSkills.some(js => js.toLowerCase().includes(s.toLowerCase()) || 
                                    s.toLowerCase().includes(js.toLowerCase()))
    );

    const experienceMatch = cv.experience >= job.minExperience;
    const educationMatch = cv.education.length > 0; // Simplified check
    const languageMatch = cv.languages.some(
      l => !job.keyLanguages || job.keyLanguages.includes(l.language)
    );

    // Calculate match score (0-100)
    let score = 0;
    score += (skillsMatch.length / job.requiredSkills.length) * 40; // Skills: 40%
    score += (experienceMatch ? 20 : 0); // Experience: 20%
    score += (educationMatch ? 15 : 0); // Education: 15%
    score += (languageMatch ? 10 : 0); // Languages: 10%

    // Certifications bonus
    if (job.preferredCertifications) {
      const certMatch = cv.certifications.filter(c =>
        job.preferredCertifications!.some(pc => c.toLowerCase().includes(pc.toLowerCase()))
      ).length;
      score += (certMatch / job.preferredCertifications.length) * 15;
    }

    const gaps = job.requiredSkills.filter(s => !skillsMatch.includes(s));
    const strengths = cv.skills.filter(s => job.requiredSkills.includes(s));

    let recommendation: 'strong' | 'suitable' | 'consider' | 'pass';
    if (score >= 85) recommendation = 'strong';
    else if (score >= 70) recommendation = 'suitable';
    else if (score >= 50) recommendation = 'consider';
    else recommendation = 'pass';

    return {
      candidateName: cv.name,
      jobMatch: Math.round(Math.min(score, 100)),
      skillsMatch,
      experienceMatch,
      educationMatch,
      languageMatch,
      strengths,
      gaps,
      recommendedQuestions: this.generateQuestions(cv, gaps),
      overallRecommendation: recommendation
    };
  }

  /**
   * Generate interview questions for skill gaps
   */
  private generateQuestions(cv: CandidateCV, gaps: string[]): string[] {
    const questions: string[] = [];

    if (gaps.includes('TypeScript')) {
      questions.push('How would you approach learning TypeScript if you haven\'t used it before?');
    }
    if (gaps.includes('Python')) {
      questions.push('Describe your experience with Python and how you\'d apply it to our projects');
    }
    if (gaps.includes('React')) {
      questions.push('Tell us about your experience with modern frontend frameworks');
    }
    if (gaps.includes('AWS')) {
      questions.push('How would you handle cloud infrastructure and deployment?');
    }
    if (gaps.includes('SQL')) {
      questions.push('Describe your database design and optimization experience');
    }

    // Add behavioral questions
    if (questions.length === 0) {
      questions.push('Tell us about a technical challenge you overcame');
      questions.push('How do you approach learning new technologies?');
    }

    return questions;
  }

  /**
   * Generate interview questions for candidate
   */
  private async generateInterviewQuestions(_task: string, _context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Interjúkérdések generálása...');

    const questions: Record<string, string[]> = {
      technical: [
        'Describe your experience with TypeScript and React. What projects have you built?',
        'How would you optimize a slow-running database query?',
        'Explain your experience with cloud platforms (AWS/GCP/Azure)',
        'Tell us about a complex system you designed and the trade-offs you made',
        'How do you approach testing and code quality in your projects?'
      ],
      behavioral: [
        'Tell us about a time you faced a technical challenge and how you solved it',
        'How do you handle conflicts within a team?',
        'Describe your approach to learning new technologies',
        'Tell us about your proudest professional achievement',
        'How do you stay updated with industry trends and best practices?'
      ],
      cultural: [
        'What is your preferred team collaboration style?',
        'How do you balance innovation with stability?',
        'What motivates you in your career?',
        'How do you prioritize when facing multiple deadlines?',
        'Describe your experience mentoring or leading others'
      ]
    };

    return {
      status: 'success',
      data: {
        generatedQuestions: questions,
        tipsForAskers: [
          'Listen more, talk less - let candidates explain their thinking',
          'Ask follow-up questions to understand depth of knowledge',
          'Pay attention to problem-solving approach, not just the answer',
          'Look for cultural fit and growth mindset',
          'Provide realistic work scenarios'
        ],
        totalQuestions: Object.values(questions).reduce((sum, arr) => sum + arr.length, 0)
      }
    };
  }
}
