import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileText, Download, Sparkles, GraduationCap, BookOpen, AlertCircle, Upload, RefreshCw, Camera, Lock, Brain, Zap, Megaphone, ClipboardCheck, History, Copy, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PaperUpdatesChannel } from '@/components/PaperUpdatesChannel';

// Class 10 Maharashtra State Board curriculum (merged: original + updated chapters)
const CURRICULUM_BY_CLASS = {
  'Class 10': {
    'English': {
      'Unit 1': [
        '1.1 Where the Mind is Without Fear...',
        "1.2 The Thief's Story",
        '1.3 On Wings of Courage',
        "1.4 All the World's a Stage",
        '1.5 Joan of Arc',
        '1.6 The Alchemy of Nature',
        'The Twins',
      ],
      'Unit 2': [
        '2.1 Animals',
        '2.2 Three Questions',
        '2.3 Connecting the Dots',
        '2.4 The Pulley',
        "2.5 Let's March",
        '2.6 Science and Spirituality',
        'The Half-yearly Exam',
        'Basketful of Moonlight',
        'The Elevator',
      ],
      'Unit 3': [
        '3.1 Night of the Scorpion',
        '3.2 The Night I Met Einstein',
        '3.3 Stephen Hawking',
        '3.4 The Will to Win',
        '3.5 Unbeatable Super Mom – Mary Kom',
        '3.6 The Concert',
      ],
      'Unit 4': [
        '4.1 A Thing of Beauty is a Joy For Ever',
        '4.2 The Luncheon',
        '4.3 World Heritage',
        '4.4 The Height of the Ridiculous',
        '4.5 The Old Man and The Sea : Book Review',
        '4.6 The Gift of the Magi',
      ],
      'Grammar & Writing Skills': ['Grammar', 'Writing Skills'],
    },
    'Marathi (मराठी)': {
      'भाग १': ['कविता विभाग', 'गद्य विभाग'],
      'भाग २': ['उपयोजित लेखन', 'व्याकरण'],
    },
    'Hindi (हिंदी)': {
      'इकाई 1': ['पद्यांश', 'गद्यांश'],
      'इकाई 2': ['रचना विभाग', 'व्याकरण विभाग'],
    },
    'Mathematics 1 (Algebra)': {
      'All Chapters': [
        '1. Linear Equations in Two Variables',
        '2. Quadratic Equations',
        '3. Arithmetic Progression',
        '4. Financial Planning',
        '5. Probability',
        '6. Statistics',
      ],
    },
    'Mathematics 2 (Geometry)': {
      'All Chapters': [
        '1. Similarity',
        '2. Pythagoras Theorem',
        '3. Circle',
        '4. Geometric Constructions',
        '5. Co-ordinate Geometry',
        '6. Trigonometry',
        '7. Mensuration',
      ],
    },
    'Science 1': {
      'All Chapters': [
        '1. Gravitation',
        '2. Periodic Classification of Elements',
        '3. Chemical Reactions and Equations',
        '4. Effects of Electric Current',
        '5. Heat',
        '6. Refraction of Light',
        '7. Lenses',
        '8. Metallurgy',
        '9. Carbon Compounds',
        '10. Space Missions',
      ],
    },
    'Science 2': {
      'All Chapters': [
        '1. Heredity and Evolution',
        '2. Life Processes in Living Organisms Part 1',
        '3. Life Processes in Living Organisms Part 2',
        '4. Environmental Management',
        '5. Towards Green Energy',
        '6. Animal Classification',
        '7. Introduction to Microbiology',
        '8. Cell Biology and Biotechnology',
        '9. Social Health',
        '10. Disaster Management',
      ],
    },
    'History & Political Science': {
      'Unit 1': ['Historiography', 'Applied History', 'Democracy'],
      'Unit 2': ["India's Democratic Government", 'Political Parties', 'Social and Political Movements'],
    },
    'Geography': {
      'Unit 1': ['Field Visit', 'Location and Extent', 'Physiography and Drainage'],
      'Unit 2': ['Natural Vegetation and Wildlife', 'Population', 'Economy and Occupation'],
    },
  },
} as const;

const MARKS_OPTIONS = ['20', '40', '80', '100'];
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard', 'Very Difficult (Unsolvable)'];
const TERM_OPTIONS = ['Term 1', 'Term 2', 'Full Syllabus'];

export function TestGenerator() {
  const { user } = useAuth();
  const [selectedClass] = useState<'Class 10'>('Class 10');
  const [subject, setSubject] = useState<string>('');
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedUnitTerms, setSelectedUnitTerms] = useState<Record<string, string>>({});
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [totalMarks, setTotalMarks] = useState<string>('40');
  const [difficulty, setDifficulty] = useState<string>('Medium');
  const [testTitle, setTestTitle] = useState('');
  const [includeGrammar, setIncludeGrammar] = useState(true);
  const [includeWriting, setIncludeWriting] = useState(true);
  const [includePassage, setIncludePassage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [generatedTest, setGeneratedTest] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('generate');
  const [remakeInput, setRemakeInput] = useState('');
  const [remakeLoading, setRemakeLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [exampleImage, setExampleImage] = useState<string | null>(null);
  const [exampleLoading, setExampleLoading] = useState(false);
  const exampleFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Access gate state
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessChecking, setAccessChecking] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isOwnerUser, setIsOwnerUser] = useState(false);

  // Predictor state
  const [predictorInput, setPredictorInput] = useState('');
  const [predictorLoading, setPredictorLoading] = useState(false);
  const [predictorImage, setPredictorImage] = useState<string | null>(null);
  const [predictorImageLoading, setPredictorImageLoading] = useState(false);
  const predictorFileRef = useRef<HTMLInputElement>(null);
  const [directPredictLoading, setDirectPredictLoading] = useState(false);
  const [directPredictClass] = useState<'Class 10'>('Class 10');
  const [directPredictSubject, setDirectPredictSubject] = useState('');

  // Check access on mount and refresh when settings change
  useEffect(() => {
    checkAccess();
    const channel = supabase
      .channel('paper-generator-settings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paper_generator_settings' }, () => {
        setPasswordError('');
        checkAccess();
      })
      .subscribe();

    const refreshOnFocus = () => checkAccess();
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [user?.id]);

  const checkAccess = async () => {
    try {
      // Check if user is owner - only owners bypass password
      if (user?.id) {
        const { data: ownerCheck } = await supabase.rpc('is_owner', { _user_id: user.id });
        setIsOwnerUser(!!ownerCheck);
        if (ownerCheck) {
          setAccessGranted(true);
          setAccessChecking(false);
          return;
        }
      } else {
        setIsOwnerUser(false);
      }

      // Load settings
      const { data: settings } = await supabase
        .from('paper_generator_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!settings || !settings.password_enabled || !settings.password_hash?.trim()) {
        setAccessGranted(true);
      } else {
        setAccessGranted(false);
      }

      // Logged-in whitelist still works as an extra allow path, but guests never need login.
      if (user?.id && settings?.whitelist_enabled) {
        const { data: whitelisted } = await supabase
          .from('paper_generator_allowed_users')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!whitelisted) {
          setAccessGranted(false);
          setAccessChecking(false);
          return;
        }
      }
    } catch {
      setAccessGranted(true);
    } finally {
      setAccessChecking(false);
    }
  };

  const verifyPassword = async () => {
    if (!passwordInput.trim()) {
      setPasswordError('Please enter the password');
      return;
    }

    const { data: settings } = await supabase
      .from('paper_generator_settings')
      .select('password_hash')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settings?.password_hash && passwordInput.trim() === settings.password_hash.trim()) {
      setAccessGranted(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password');
    }
  };

  // Activity logging helper
  const logActivity = async (type: string, extraDetails?: Record<string, unknown>) => {
    if (!user?.id) return;
    try {
      await supabase.from('paper_generator_activity').insert([{
        user_id: user.id,
        user_email: user.email || '',
        user_name: user.name || '',
        paper_class: selectedClass,
        subject: subject || directPredictSubject || 'N/A',
        generation_type: type,
        total_marks: totalMarks,
        difficulty: difficulty,
        details: (extraDetails || {}) as Record<string, string>,
      }]);
    } catch {
      // Silent fail for logging
    }
  };

  const currentCurriculum = CURRICULUM_BY_CLASS[selectedClass] as unknown as Record<string, Record<string, readonly string[]>>;
  const subjects = Object.keys(currentCurriculum);
  const units = subject ? Object.keys(currentCurriculum[subject] || {}) : [];

  const getChaptersForUnits = () => {
    if (!subject) return [];
    const subjectData = currentCurriculum[subject] || {};
    let chapters: string[] = [];
    selectedUnits.forEach((unit) => {
      if (subjectData[unit]) {
        chapters = [...chapters, ...subjectData[unit]];
      }
    });
    return chapters;
  };

  const getDefaultTermForUnit = (unit: string) => {
    const lower = unit.toLowerCase();
    if (lower.includes('unit 1') || lower.includes('unit one') || lower.includes('पहली')) return 'Term 1';
    if (lower.includes('unit 2') || lower.includes('unit two') || lower.includes('दूसरी')) return 'Term 2';
    return 'Full Syllabus';
  };

  const toggleUnit = (unit: string) => {
    if (selectedUnits.includes(unit)) {
      const nextUnits = selectedUnits.filter((u) => u !== unit);
      setSelectedUnits(nextUnits);

      setSelectedUnitTerms((prev) => {
        const { [unit]: _, ...rest } = prev;
        return rest;
      });

      const subjectData = currentCurriculum[subject] || {};
      const unitChapters = subjectData[unit] || [];
      setSelectedChapters((prev) => prev.filter((c) => !unitChapters.includes(c)));
      return;
    }

    setSelectedUnits((prev) => [...prev, unit]);
    setSelectedUnitTerms((prev) => ({
      ...prev,
      [unit]: prev[unit] || getDefaultTermForUnit(unit),
    }));
  };

  const updateUnitTerm = (unit: string, term: string) => {
    setSelectedUnitTerms((prev) => ({ ...prev, [unit]: term }));
  };

  const toggleChapter = (chapter: string) => {
    setSelectedChapters((prev) =>
      prev.includes(chapter) ? prev.filter((c) => c !== chapter) : [...prev, chapter]
    );
  };

  const selectAllChapters = () => {
    const availableChapters = getChaptersForUnits();
    setSelectedChapters(availableChapters.length === selectedChapters.length ? [] : [...availableChapters]);
  };

  const selectAllUnits = () => {
    if (selectedUnits.length === units.length) {
      setSelectedUnits([]);
      setSelectedUnitTerms({});
      setSelectedChapters([]);
    } else {
      setSelectedUnits([...units]);
      const terms: Record<string, string> = {};
      units.forEach((unit) => {
        terms[unit] = selectedUnitTerms[unit] || getDefaultTermForUnit(unit);
      });
      setSelectedUnitTerms(terms);
    }
  };

  const isLanguageSubject = () => {
    return ['English', 'Hindi (हिंदी)', 'Sanskrit (संस्कृत)', 'Marathi (मराठी)'].includes(subject);
  };

  const generateTest = async () => {
    if (!subject || selectedChapters.length === 0) {
      toast({ title: 'Error', description: 'Please select subject and at least one chapter', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const marksNum = parseInt(totalMarks);
      const timeAllotted = marksNum === 20 ? '45 Minutes' : marksNum === 40 ? '1.5 Hours' : marksNum === 80 ? '2.5 Hours' : '3 Hours';

      const marksBlueprint = marksNum === 20
        ? 'Section A: 6 MCQ/1-mark, Section B: 4 short/2-mark, Section C: 2 long/3-mark'
        : marksNum === 40
        ? 'Section A: 10 MCQ/1-mark, Section B: 6 short/3-mark, Section C: 3 long/4-mark, Section D: 1 HOTS/4-mark'
        : marksNum === 80
        ? 'Section A: 16 MCQ/1-mark, Section B: 8 short/3-mark, Section C: 6 long/5-mark, Section D: 2 HOTS/case-study/5-mark'
        : 'Section A: 20 MCQ/1-mark, Section B: 10 short/3-mark, Section C: 8 long/5-mark, Section D: 4 HOTS/case-study/5-mark';

      const difficultyNote = difficulty === 'Easy'
        ? 'Keep questions direct and concept-check oriented. Mostly recall and basic application.'
        : difficulty === 'Hard'
        ? 'Include challenging HOTS, multi-concept linkage, and application-heavy items.'
        : difficulty === 'Very Difficult (Unsolvable)'
        ? 'Create olympiad-style, exceptionally difficult, tricky, multi-step questions with deep reasoning and non-routine framing.'
        : 'Balanced mix of concept, application, and moderate reasoning.';

      const selectedUnitTermPlan = selectedUnits
        .map((unit) => `- ${unit}: ${selectedUnitTerms[unit] || 'Full Syllabus'}`)
        .join('\n');

      const passageSection = (subject === 'English' && includePassage) ? `

**IMPORTANT: Include an UNSEEN PASSAGE section (not from textbook) with 5 comprehension questions worth 10 marks.**
The passage should be around 150-200 words on a general topic (nature, technology, environment, etc.).` : '';

      const customInstructions = customPrompt.trim() ? `\n\n**ADDITIONAL INSTRUCTIONS FROM USER:**\n${customPrompt.trim()}\n` : '';

      const prompt = `Create a ${totalMarks} marks ${subject} question paper for ${selectedClass} Maharashtra State Board.

**FORMAT REQUIREMENTS:**
- Time: ${timeAllotted}
- Difficulty: ${difficulty} - ${difficultyNote}
- Pattern: Follow shala.com, balbharti.com, and maharastrastudy.com exam pattern exactly
- STRICT SCALING RULE: More marks must always produce significantly more total questions
- Marks blueprint to follow exactly: ${marksBlueprint}

**UNIT + TERM PLAN (must respect this mapping):**
${selectedUnitTermPlan || '- Full syllabus coverage'}

**CHAPTERS TO COVER (distribute questions proportionally):**
${selectedChapters.join(', ')}

${isLanguageSubject() ? `**LANGUAGE SECTIONS:**
${includeGrammar ? '- Grammar section with appropriate marks' : ''}
${includeWriting ? '- Writing Skills (Essay/Letter/Paragraph)' : ''}` : ''}
${passageSection}
${customInstructions}
**SPACING & FORMATTING:**
- Use clear section headers: **SECTION A**, **SECTION B**, etc.
- Add blank lines between questions
- Show marks clearly: [2 marks], [5 marks], etc.
- Number all questions: Q.1, Q.2, Q.3, etc.
- Add proper sub-question numbering: a), b), c) or i), ii), iii)

**QUALITY RULES:**
- Generate UNIQUE questions each time
- Questions must be exam-standard and appropriate for ${selectedClass}
- Improve conceptual quality, clarity, and logic in every difficulty mode
- End with: ✱✱✱ Best of Luck! ✱✱✱

Generate the complete question paper now:`;

      const response = await supabase.functions.invoke('test-generator', {
        body: { prompt },
      });

      if (response.error) throw response.error;
      
      const paper = response.data?.paper;
      if (!paper) {
        throw new Error('No response generated');
      }

      setGeneratedTest(paper);
      setActiveTab('result');
      await logActivity('generate', { chapters: selectedChapters });
      toast({ title: 'Test Generated!', description: `${difficulty} difficulty paper ready in seconds!` });
    } catch (error: any) {
      console.error('Error generating test:', error);
      toast({ title: 'Error', description: error.message || 'Failed to generate test', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const remakeQuestions = async () => {
    if (!remakeInput.trim()) {
      toast({ title: 'Error', description: 'Please paste your question paper', variant: 'destructive' });
      return;
    }

    setRemakeLoading(true);
    try {
      const prompt = `You are an expert question paper modifier. Take the following question paper and create a NEW version with DIFFERENT questions on the SAME topics and format.

**ORIGINAL PAPER:**
${remakeInput}

**INSTRUCTIONS:**
1. Keep the SAME format, marks distribution, and structure
2. Keep the SAME section headers and time
3. REPLACE all questions with NEW, DIFFERENT questions on similar topics
4. Maintain the same difficulty level
5. For MCQs, change both questions and options
6. For descriptive questions, ask about different aspects
7. End with: ✱✱✱ Best of Luck! ✱✱✱

Generate the modified question paper now:`;

      const response = await supabase.functions.invoke('test-generator', {
        body: { prompt },
      });

      if (response.error) throw response.error;
      
      const paper = response.data?.paper;
      if (!paper) throw new Error('No response generated');

      setGeneratedTest(paper);
      setActiveTab('result');
      await logActivity('remake');
      toast({ title: 'Questions Remade!', description: 'New version ready with different questions' });
    } catch (error: any) {
      console.error('Error remaking questions:', error);
      toast({ title: 'Error', description: error.message || 'Failed to remake questions', variant: 'destructive' });
    } finally {
      setRemakeLoading(false);
    }
  };

  const handleExampleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setExampleImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const generateFromExample = async () => {
    if (!exampleImage) {
      toast({ title: 'Error', description: 'Please upload a paper image first', variant: 'destructive' });
      return;
    }

    setExampleLoading(true);
    try {
      // First, analyze the image to extract the paper content
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('image-ai', {
        body: {
          action: 'analyze',
          imageUrl: exampleImage,
          prompt: `You are an expert Maharashtra State Board exam paper analyzer. Look at this question paper image carefully and extract EVERYTHING:

1. Class and Subject
2. Total marks and time
3. All section headers (Section A, B, C, D etc.)
4. Every single question with its marks
5. Question types (MCQ, short answer, long answer, etc.)
6. The exact marks distribution pattern

Output the complete paper content as plain text, preserving the structure exactly.`
        }
      });

      if (analysisError) throw analysisError;

      const extractedPaper = analysisData?.analysis;
      if (!extractedPaper) throw new Error('Could not read the paper image');

      // Now generate a similar paper with different questions
      const prompt = `You are an expert Maharashtra State Board question paper creator. I have an example paper below. Create a COMPLETELY NEW paper with DIFFERENT questions but following the EXACT SAME format, structure, marks distribution, and difficulty level.

EXAMPLE PAPER (follow this pattern exactly):
${extractedPaper}

INSTRUCTIONS:
1. Keep the EXACT same format: same sections, same marks per question, same number of questions
2. Keep the same subject, class, and total marks
3. REPLACE ALL questions with NEW, DIFFERENT questions on the same topics/chapters
4. For MCQs: new questions with new options
5. For descriptive: different aspects of the same topics
6. Follow shala.com, balbharti.com, maharastrastudy.com, and BYJU'S exam patterns
7. Maintain the same difficulty level
8. End with: ✱✱✱ Best of Luck! ✱✱✱

Generate the new question paper now:`;

      const response = await supabase.functions.invoke('test-generator', {
        body: { prompt },
      });

      if (response.error) throw response.error;

      const paper = response.data?.paper;
      if (!paper) throw new Error('No response generated');

      setGeneratedTest(paper);
      setActiveTab('result');
      await logActivity('example_paper');
      toast({ title: 'Paper Generated!', description: 'New paper created matching your example format!' });
    } catch (error: any) {
      console.error('Error generating from example:', error);
      toast({ title: 'Error', description: error.message || 'Failed to generate paper from example', variant: 'destructive' });
    } finally {
      setExampleLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!generatedTest) return;

    const printContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${testTitle || `${selectedClass} - ${subject} Test`}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Times New Roman', Georgia, serif; 
      padding: 50px 60px; 
      line-height: 2; 
      max-width: 900px; 
      margin: auto; 
      background: white;
      color: #1a1a1a;
      font-size: 14px;
    }
    h1, h2, h3 { color: #000; margin: 20px 0 15px 0; font-weight: bold; }
    h1 { text-align: center; border-bottom: 3px double #333; padding-bottom: 15px; font-size: 22px; margin-bottom: 25px; }
    h2 { background: #f0f0f0; padding: 10px 15px; margin-top: 30px; font-size: 16px; border-left: 5px solid #333; }
    h3 { font-size: 15px; margin-top: 20px; }
    p, li { margin: 12px 0; line-height: 2.2; }
    .content { 
      white-space: pre-wrap; 
      word-wrap: break-word; 
      font-family: inherit; 
      font-size: 14px;
      line-height: 2.2;
    }
    strong { font-weight: bold; }
    @media print { 
      body { padding: 30px 40px; } 
      @page { margin: 1.5cm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="content">${generatedTest.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\n/g, '\n\n<br>\n')}</div>
</body>
</html>`;

    const blob = new Blob([printContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${testTitle || `${selectedClass.replace(' ', '-')}-${subject}-${difficulty}-Test`}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'Downloaded!', description: 'Open the HTML file and Print → Save as PDF' });
  };

  const downloadAsTxt = () => {
    if (!generatedTest) return;

    const blob = new Blob([generatedTest], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${testTitle || `${selectedClass.replace(' ', '-')}-${subject}-${difficulty}-Test`}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'Downloaded as Text!' });
  };

  const availableChapters = getChaptersForUnits();

  // Paper Predictor - from previous papers
  const predictFromPapers = async () => {
    if (!predictorInput.trim() && !predictorImage) {
      toast({ title: 'Error', description: 'Please paste previous papers or upload an image', variant: 'destructive' });
      return;
    }

    setPredictorLoading(true);
    try {
      let paperContent = predictorInput;

      // If image uploaded, analyze it first
      if (predictorImage) {
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke('image-ai', {
          body: {
            action: 'analyze',
            imageUrl: predictorImage,
            prompt: `Extract ALL questions, marks, sections, and topics from this exam paper. Output the complete content preserving structure.`
          }
        });
        if (analysisError) throw analysisError;
        paperContent = (paperContent ? paperContent + '\n\n--- UPLOADED PAPER ---\n\n' : '') + (analysisData?.analysis || '');
      }

      const prompt = `You are an expert Maharashtra State Board exam paper PREDICTOR. Analyze the following previous year question papers/tests carefully and PREDICT what the NEXT exam paper will look like.

**PREVIOUS PAPERS/TESTS PROVIDED:**
${paperContent}

**YOUR TASK:**
1. Analyze the question patterns, topics that appear repeatedly, marks distribution
2. Identify which topics are most likely to appear in the next exam
3. Note the difficulty trends and question type distribution
4. Identify any chapter rotation patterns

**GENERATE A PREDICTED PAPER that:**
- Covers the topics most likely to appear based on pattern analysis
- Follows the same format, marks distribution, and structure
- Includes questions on topics that haven't appeared recently (rotation prediction)
- Increases focus on high-weightage chapters
- Maintains the same difficulty level
- Uses the EXACT exam format (Section A, B, C, D with correct marks)

**PREDICTION CONFIDENCE:**
- Mark each question with a confidence tag: [HIGH PROBABILITY], [MEDIUM PROBABILITY], [POSSIBLE]
- Add a brief "Prediction Analysis" section at the top explaining your reasoning

End with: ✱✱✱ Best of Luck! ✱✱✱

Generate the predicted paper now:`;

      const response = await supabase.functions.invoke('test-generator', {
        body: { prompt },
      });

      if (response.error) throw response.error;
      const paper = response.data?.paper;
      if (!paper) throw new Error('No response generated');

      setGeneratedTest(paper);
      setActiveTab('result');
      await logActivity('predict_from_papers');
      toast({ title: 'Paper Predicted!', description: 'AI analyzed patterns and generated a predicted paper' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to predict paper', variant: 'destructive' });
    } finally {
      setPredictorLoading(false);
    }
  };

  // Direct Predict - no previous papers needed
  const directPredict = async () => {
    if (!directPredictSubject) {
      toast({ title: 'Error', description: 'Please select a subject', variant: 'destructive' });
      return;
    }

    setDirectPredictLoading(true);
    try {
      const prompt = `You are an expert Maharashtra State Board exam paper PREDICTOR for ${directPredictClass} ${directPredictSubject}.

Based on your knowledge of:
- Maharashtra State Board exam patterns from 2018-2025
- shala.com, balbharti.com, maharastrastudy.com previous papers
- Common chapter weightage and question rotation patterns
- Important topics that frequently appear in board exams
- High-scoring and must-prepare chapters

**PREDICT the most likely upcoming board exam paper for ${directPredictClass} ${directPredictSubject}.**

**REQUIREMENTS:**
- Generate a FULL question paper with proper sections (A, B, C, D)
- Use ${totalMarks} marks format
- Mark each question with confidence: [HIGH PROBABILITY], [MEDIUM PROBABILITY], [POSSIBLE]
- Include a "📊 Prediction Analysis" section at the top with:
  - Most likely topics (with % probability)
  - Chapters to focus on
  - Expected question types
  - Tips for preparation
- Focus on chapters that historically appear most frequently
- Include at least 2-3 "surprise" questions on less common but important topics
- End with: ✱✱✱ Best of Luck! ✱✱✱

Generate the predicted paper now:`;

      const response = await supabase.functions.invoke('test-generator', {
        body: { prompt },
      });

      if (response.error) throw response.error;
      const paper = response.data?.paper;
      if (!paper) throw new Error('No response generated');

      setGeneratedTest(paper);
      setActiveTab('result');
      await logActivity('direct_predict', { predictedSubject: directPredictSubject });
      toast({ title: 'Paper Predicted!', description: `AI predicted the most likely ${directPredictSubject} paper` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to predict paper', variant: 'destructive' });
    } finally {
      setDirectPredictLoading(false);
    }
  };

  const handlePredictorImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => setPredictorImage(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const directPredictSubjects = Object.keys(CURRICULUM_BY_CLASS[directPredictClass] as unknown as Record<string, unknown>);

  // Password gate UI
  if (accessChecking) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!accessGranted) {
    return (
      <div className="max-w-md mx-auto space-y-6 p-6">
        <div className="text-center space-y-2">
          <Lock className="h-12 w-12 text-primary mx-auto" />
          <h2 className="text-xl font-bold">Paper Generator Access</h2>
          <p className="text-muted-foreground text-sm">
            This feature requires authorization. Enter the password to continue.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter access password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
              />
              {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            </div>
            <Button onClick={verifyPassword} className="w-full">
              <Lock className="h-4 w-4 mr-2" />
              Unlock
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <GraduationCap className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {selectedClass} Test Generator
          </h1>
        </div>
        <p className="text-muted-foreground">Maharashtra State Board - AI Powered Question Papers</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge variant="outline">⚡ Fast Generation (5-10s)</Badge>
          <Badge variant="outline">shala.com Pattern</Badge>
          <Badge variant="outline">Balbharti Syllabus</Badge>
          <Badge variant="outline">maharastrastudy.com</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-2 px-2">
          <TabsList className="inline-flex w-auto min-w-max gap-1">
            <TabsTrigger value="generate" className="text-xs sm:text-sm">
              <Sparkles className="h-4 w-4 mr-1" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="predict" className="text-xs sm:text-sm">
              <Brain className="h-4 w-4 mr-1" />
              Predict
            </TabsTrigger>
            <TabsTrigger value="direct-predict" className="text-xs sm:text-sm">
              <Zap className="h-4 w-4 mr-1" />
              Direct Predict
            </TabsTrigger>
            <TabsTrigger value="example" className="text-xs sm:text-sm">
              <Camera className="h-4 w-4 mr-1" />
              Example
            </TabsTrigger>
            <TabsTrigger value="remake" className="text-xs sm:text-sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Remake
            </TabsTrigger>
            <TabsTrigger value="result" disabled={!generatedTest} className="text-xs sm:text-sm">
              <FileText className="h-4 w-4 mr-1" />
              Result
            </TabsTrigger>
            <TabsTrigger value="updates" className="text-xs sm:text-sm">
              <Megaphone className="h-4 w-4 mr-1" />
              Updates
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Subject Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Class & Subject
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Class</Label>
                  <div className="mt-2 px-3 py-2 rounded-md border bg-muted/30 text-sm font-medium">Class 10 (Maharashtra State Board)</div>
                </div>

                <div>
                  <Label>Subject</Label>
                  <Select value={subject} onValueChange={(val) => {
                    setSubject(val);
                    setSelectedUnits([]);
                    setSelectedUnitTerms({});
                    setSelectedChapters([]);
                  }}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Marks & Difficulty */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Test Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Total Marks</Label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {MARKS_OPTIONS.map(m => (
                      <Button
                        key={m}
                        variant={totalMarks === m ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTotalMarks(m)}
                      >
                        {m}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Difficulty</Label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {DIFFICULTY_OPTIONS.map(d => (
                      <Button
                        key={d}
                        variant={difficulty === d ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDifficulty(d)}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Units Selection */}
          {subject && units.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Units</CardTitle>
                  <Button variant="ghost" size="sm" onClick={selectAllUnits}>
                    {selectedUnits.length === units.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {units.map((unit) => (
                    <Button
                      key={unit}
                      variant={selectedUnits.includes(unit) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleUnit(unit)}
                    >
                      {unit}
                    </Button>
                  ))}
                </div>

                {selectedUnits.length > 0 && (
                  <div className="space-y-3 border rounded-md p-3">
                    <Label>Unit ↔ Term mapping</Label>
                    {selectedUnits.map((unit) => (
                      <div key={`${unit}-term`} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                        <span className="text-sm text-muted-foreground">{unit}</span>
                        <Select
                          value={selectedUnitTerms[unit] || 'Full Syllabus'}
                          onValueChange={(val) => updateUnitTerm(unit, val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Term" />
                          </SelectTrigger>
                          <SelectContent>
                            {TERM_OPTIONS.map((term) => (
                              <SelectItem key={`${unit}-${term}`} value={term}>{term}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Chapters Selection */}
          {availableChapters.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Chapters ({selectedChapters.length}/{availableChapters.length})</CardTitle>
                  <Button variant="ghost" size="sm" onClick={selectAllChapters}>
                    {selectedChapters.length === availableChapters.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {availableChapters.map(chapter => (
                      <div key={chapter} className="flex items-center gap-2">
                        <Checkbox
                          id={chapter}
                          checked={selectedChapters.includes(chapter)}
                          onCheckedChange={() => toggleChapter(chapter)}
                        />
                        <Label htmlFor={chapter} className="text-sm cursor-pointer">{chapter}</Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Language Options */}
          {isLanguageSubject() && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Language Sections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="grammar" checked={includeGrammar} onCheckedChange={(c) => setIncludeGrammar(c as boolean)} />
                  <Label htmlFor="grammar">Include Grammar Section</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="writing" checked={includeWriting} onCheckedChange={(c) => setIncludeWriting(c as boolean)} />
                  <Label htmlFor="writing">Include Writing Skills</Label>
                </div>
                {subject === 'English' && (
                  <div className="flex items-center gap-2">
                    <Checkbox id="passage" checked={includePassage} onCheckedChange={(c) => setIncludePassage(c as boolean)} />
                    <Label htmlFor="passage">Include Unseen Passage</Label>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Custom Prompt (Optional) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Custom Instructions (Optional)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Give AI specific instructions for your paper — e.g. "Focus more on MCQs", "Include diagram-based questions", "Add case studies"
              </p>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="e.g., Include more application-based questions, add 2 diagram questions, focus on Chapter 3..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-[80px] resize-y"
              />
            </CardContent>
          </Card>

          {/* Optional Title */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Optional: Test Title</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="e.g., Unit Test 1 - October 2024"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button 
            onClick={generateTest} 
            disabled={loading || !subject || selectedChapters.length === 0}
            className="w-full h-12 text-lg"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating (5-10 seconds)...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Test Paper
              </>
            )}
          </Button>
        </TabsContent>

        {/* Predict Tab */}
        <TabsContent value="predict" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Paper Predictor
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Paste previous year papers or upload images — AI will analyze patterns and predict the next paper
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste previous year question papers here...&#10;&#10;You can paste multiple papers separated by ---&#10;The more papers you provide, the better the prediction!"
                value={predictorInput}
                onChange={(e) => setPredictorInput(e.target.value)}
                className="min-h-[250px] font-mono text-sm"
              />
              <div className="text-center text-sm text-muted-foreground">— OR upload a paper image —</div>
              <input ref={predictorFileRef} type="file" accept="image/*" onChange={handlePredictorImageSelect} className="hidden" />
              <Button variant="outline" className="w-full border-dashed border-2" onClick={() => predictorFileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {predictorImage ? 'Change Paper Image' : 'Upload Previous Paper Image'}
              </Button>
              {predictorImage && (
                <div className="rounded-xl overflow-hidden border">
                  <img src={predictorImage} alt="Previous paper" className="w-full h-auto max-h-48 object-contain bg-muted/30" />
                </div>
              )}
              <Button onClick={predictFromPapers} disabled={predictorLoading || (!predictorInput.trim() && !predictorImage)} className="w-full h-12" size="lg">
                {predictorLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing & Predicting...</> : <><Brain className="mr-2 h-5 w-5" /> Predict Next Paper</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Direct Predict Tab */}
        <TabsContent value="direct-predict" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Direct Paper Prediction
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                AI predicts the most likely upcoming paper based on historical Maharashtra Board patterns — no previous papers needed!
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Class</Label>
                <Select value={directPredictClass} onValueChange={(v) => { setDirectPredictClass(v as any); setDirectPredictSubject(''); }}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Class 9">Class 9</SelectItem>
                    <SelectItem value="Class 10">Class 10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Select value={directPredictSubject} onValueChange={setDirectPredictSubject}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                  <SelectContent>
                    {directPredictSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Total Marks</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {MARKS_OPTIONS.map(m => (
                    <Button key={m} variant={totalMarks === m ? 'default' : 'outline'} size="sm" onClick={() => setTotalMarks(m)}>{m}</Button>
                  ))}
                </div>
              </div>
              <Button onClick={directPredict} disabled={directPredictLoading || !directPredictSubject} className="w-full h-12" size="lg">
                {directPredictLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Predicting Paper...</> : <><Zap className="mr-2 h-5 w-5" /> Predict Paper Now</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Example Paper Tab */}
        <TabsContent value="example" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Generate from Example Paper
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload a photo of any question paper and AI will create a new paper with different questions but the same format, marks, and structure.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={exampleFileRef}
                type="file"
                accept="image/*"
                onChange={handleExampleImageSelect}
                className="hidden"
              />
              <Button
                onClick={() => exampleFileRef.current?.click()}
                variant="outline"
                className="w-full h-16 border-dashed border-2 hover:border-primary hover:bg-primary/5"
                disabled={exampleLoading}
              >
                <Upload className="h-5 w-5 mr-2" />
                {exampleImage ? 'Change Paper Image' : 'Upload Paper Photo'}
              </Button>

              {exampleImage && (
                <div className="space-y-4">
                  <div className="rounded-xl overflow-hidden border border-border">
                    <img src={exampleImage} alt="Example paper" className="w-full h-auto max-h-72 object-contain bg-muted/30" />
                  </div>
                  <Button
                    onClick={generateFromExample}
                    disabled={exampleLoading}
                    className="w-full h-12"
                    size="lg"
                  >
                    {exampleLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Analyzing & Generating (10-15s)...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Generate Similar Paper
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Remake Tab */}
        <TabsContent value="remake" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Question Remake
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Paste your existing question paper and AI will create new questions with the same format
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste your question paper here...&#10;&#10;AI will keep the same format, marks, and structure but replace all questions with new ones."
                value={remakeInput}
                onChange={(e) => setRemakeInput(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
              <Button 
                onClick={remakeQuestions}
                disabled={remakeLoading || !remakeInput.trim()}
                className="w-full"
              >
                {remakeLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Remaking Questions...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Remake Questions
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Result Tab */}
        <TabsContent value="result" className="space-y-4 mt-6">
          {generatedTest && (
            <>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={downloadPDF} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download HTML (Print as PDF)
                </Button>
                <Button onClick={downloadAsTxt} variant="outline" className="flex-1">
                  <FileText className="mr-2 h-4 w-4" />
                  Download as Text
                </Button>
              </div>

              <Card>
                <CardContent className="p-6">
                  <ScrollArea className="h-[600px]">
                    <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap">
                      {generatedTest.split('\n').map((line, i) => {
                        // Convert **text** to bold and remove stars
                        const parts = line.split(/\*\*(.*?)\*\*/g);
                        return (
                          <div key={i} className={line === '' ? 'h-3' : ''}>
                            {parts.map((part, j) =>
                              j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Updates Tab */}
        <TabsContent value="updates" className="mt-6">
          <PaperUpdatesChannel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
