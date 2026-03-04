import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileText, Download, Sparkles, GraduationCap, BookOpen, AlertCircle, Upload, RefreshCw, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// Class-wise curriculum with units/chapters
const CURRICULUM_BY_CLASS = {
  'Class 9': {
    'English': {
      'Unit One': ['1.1: Life', '1.2: A Synopsis-The Swiss Family Robinson', '1.3: Have you ever seen...?', '1.4: Have you thought of the verb \'have\'', '1.5: The Necklace'],
      'Unit Two': ['2.1: Invictus', '2.2: A True Story of Sea Turtles', '2.3: Somebody\'s Mother', '2.4: The Fall of Troy', '2.5: Autumn', '2.6: The Past in the Present'],
      'Unit Three': ['3.1: Silver', '3.2: Reading Works of Art', '3.3: The Road Not Taken', '3.4: How the First Letter was Written'],
      'Unit Four': ['4.1: Please Listen!', '4.2: The Storyteller', '4.3: Intellectual Rubbish', '4.4: My Financial Career', '4.5: Tansen'],
      'Grammar & Writing Skills': ['Grammar', 'Writing Skills']
    },
    'Hindi (हिंदी)': {
      'पहली इकाई': ['१: नदी की पुकार', '२: झुमका', '३: निज भाषा', '४: मान जा मेरे मन'],
      'दूसरी इकाई': ['१: गागर में सागर', '२: मैं बरतन माँजूँगा', '३: ग्रामदेवता', '४: साहित्य की निष्कपट विधा है - डायरी']
    },
    'Sanskrit (संस्कृत)': {
      'गद्यात्मकम्': ['संस्कृतम्', 'विद्यावन्तः', 'समयः'],
      'पद्यात्मकम्': ['सुभाषिते खरे', 'कालमहत्त्वम्', 'किं कर्तव्यम्? किं न कर्तव्यम्?'],
      'व्याकरणम्': ['वाक्य संरचना', 'विभक्तयः', 'सन्धयः']
    },
    'Marathi (मराठी)': {
      'भाग – १': ['संतवाणीचे संदर्भ', 'दलितांचे आंबेडकर', 'कालचक्र'],
      'भाग – २': ['ध्यानातले पहाट', 'ओळखीचा वेडाचा गाव', 'हरवलेलं मूल'],
      'भाग – ३': ['उजाड उघडे माळरान', 'छपर', 'होमी'],
      'भाग – ४': ['जीवनातला आनंद', 'उपयोजित लेखन']
    },
    'Math 1 - Algebra': {
      'Unit 1': ['Sets', 'Real Numbers', 'Polynomials', 'Ratio and Proportion'],
      'Unit 2': ['Linear Equations in Two Variables', 'Financial Planning', 'Statistics']
    },
    'Math 2 - Geometry': {
      'Unit 1': ['Basic Concepts in Geometry', 'Parallel Lines', 'Triangles', 'Constructions of Triangles'],
      'Unit 2': ['Quadrilaterals', 'Circle', 'Co-ordinate Geometry', 'Trigonometry', 'Surface Area and Volume']
    },
    'Science 1': {
      'Unit 1': ['1: Laws of Motion', '2: Work and Energy', '3: Current Electricity', '4: Measurement of Matter', '5: Acids, Bases and Salts'],
      'Unit 2': ['6: Classification of Plants', '7: Energy Flow in an Ecosystem', '8: Useful and Harmful Microbes', '9: Environmental Management', '10: Information Communication Technology']
    },
    'Science 2': {
      'Unit 1': ['11: Reflection of Light', '12: Study of Sound', '13: Carbon: An important element'],
      'Unit 2': ['14: Substances in Common Use', '15: Life Processes in Living Organisms', '16: Heredity and Variation', '17: Introduction to Biotechnology', '18: Observing Space: Telescopes']
    },
    'History & Political Science': {
      'Unit 1': ['History: Sources of History', 'History: India : Events after 1960', 'Political Science: Post World War Political Developments'],
      'Unit 2': ['History: Economic Development', 'History: Education', 'Political Science: India\'s Foreign Policy', 'Political Science: The United Nations']
    },
    'Geography': {
      'Unit 1': ['1: Distributional Maps', '2: Endogenetic Movements', '3: Exogenetic Movements Part-1', '4: Exogenetic Movements Part-2', '5: Precipitation', '6: Properties of sea water'],
      'Unit 2': ['7: International Date Line', '8: Introduction to Economics', '9: Trade', '10: Urbanisation', '11: Transport and Communication', '12: Tourism']
    }
  },
  'Class 10': {
    'English': {
      'Unit 1': ['Where the Mind is Without Fear', 'The Thief\'s Story', 'Animals', 'The Twins'],
      'Unit 2': ['The Night I Met Einstein', 'The Half-yearly Exam', 'Basketful of Moonlight', 'The Elevator'],
      'Grammar & Writing Skills': ['Grammar', 'Writing Skills']
    },
    'Marathi (मराठी)': {
      'भाग १': ['कविता विभाग', 'गद्य विभाग'],
      'भाग २': ['उपयोजित लेखन', 'व्याकरण']
    },
    'Hindi (हिंदी)': {
      'इकाई 1': ['पद्यांश', 'गद्यांश'],
      'इकाई 2': ['रचना विभाग', 'व्याकरण विभाग']
    },
    'Math 1 - Algebra': {
      'Unit 1': ['Linear Equations', 'Quadratic Equations', 'Progressions'],
      'Unit 2': ['Financial Planning', 'Probability', 'Statistics']
    },
    'Math 2 - Geometry': {
      'Unit 1': ['Similarity', 'Pythagoras Theorem', 'Coordinate Geometry'],
      'Unit 2': ['Trigonometry', 'Mensuration', 'Circle']
    },
    'Science 1': {
      'Unit 1': ['Gravitation', 'Periodic Classification', 'Chemical Reactions'],
      'Unit 2': ['Effects of Electric Current', 'Heat', 'Light']
    },
    'Science 2': {
      'Unit 1': ['Life Processes', 'Heredity', 'Environment Management'],
      'Unit 2': ['Social Health', 'Disaster Management', 'Applied Biology']
    },
    'History & Political Science': {
      'Unit 1': ['Historiography', 'Applied History', 'Democracy'],
      'Unit 2': ['India\'s Democratic Government', 'Political Parties', 'Social and Political Movements']
    },
    'Geography': {
      'Unit 1': ['Field Visit', 'Location and Extent', 'Physiography and Drainage'],
      'Unit 2': ['Natural Vegetation and Wildlife', 'Population', 'Economy and Occupation']
    }
  }
} as const;

const MARKS_OPTIONS = ['20', '40', '80', '100'];
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard', 'Very Difficult (Unsolvable)'];
const TERM_OPTIONS = ['Term 1', 'Term 2', 'Full Syllabus'];

export function TestGenerator() {
  const [selectedClass, setSelectedClass] = useState<'Class 9' | 'Class 10'>('Class 9');
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: 'Error', description: 'Please log in to generate tests', variant: 'destructive' });
        return;
      }

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
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (response.error) throw response.error;
      
      const paper = response.data?.paper;
      if (!paper) {
        throw new Error('No response generated');
      }

      setGeneratedTest(paper);
      setActiveTab('result');
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: 'Error', description: 'Please log in', variant: 'destructive' });
        return;
      }

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
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (response.error) throw response.error;
      
      const paper = response.data?.paper;
      if (!paper) throw new Error('No response generated');

      setGeneratedTest(paper);
      setActiveTab('result');
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: 'Error', description: 'Please log in', variant: 'destructive' });
        return;
      }

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
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (response.error) throw response.error;

      const paper = response.data?.paper;
      if (!paper) throw new Error('No response generated');

      setGeneratedTest(paper);
      setActiveTab('result');
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
            <TabsTrigger value="example" className="text-xs sm:text-sm">
              <Camera className="h-4 w-4 mr-1" />
              Example Paper
            </TabsTrigger>
            <TabsTrigger value="remake" className="text-xs sm:text-sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Remake
            </TabsTrigger>
            <TabsTrigger value="result" disabled={!generatedTest} className="text-xs sm:text-sm">
              <FileText className="h-4 w-4 mr-1" />
              Result
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
                  <Select value={selectedClass} onValueChange={(val) => {
                    setSelectedClass(val as 'Class 9' | 'Class 10');
                    setSubject('');
                    setSelectedUnits([]);
                    setSelectedUnitTerms({});
                    setSelectedChapters([]);
                  }}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Class 9">Class 9</SelectItem>
                      <SelectItem value="Class 10">Class 10</SelectItem>
                    </SelectContent>
                  </Select>
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
      </Tabs>
    </div>
  );
}
