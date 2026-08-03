import React from 'react';
import { X, FileText, FileSignature, FileArchive, FileCheck, FileCog, Briefcase, Calculator, Building, BookOpen, GraduationCap, Layout } from 'lucide-react';

const templates = [
  { id: 'blank', name: 'Blank Document', icon: FileText, content: '' },
  { id: 'contract', name: 'Contract', icon: FileSignature, content: '<h1>Contract Agreement</h1><p>This Contract is made between...</p>' },
  { id: 'proposal', name: 'Proposal', icon: Briefcase, content: '<h1>Project Proposal</h1><h2>Executive Summary</h2><p>...</p>' },
  { id: 'report', name: 'Report', icon: FileArchive, content: '<h1>Quarterly Report</h1><h2>Introduction</h2><p>...</p>' },
  { id: 'minutes', name: 'Meeting Minutes', icon: FileCheck, content: '<h1>Meeting Minutes</h1><p><strong>Date:</strong></p><p><strong>Attendees:</strong></p><h2>Agenda Items</h2><ul><li>Item 1</li></ul>' },
  { id: 'communique', name: 'Communiqué', icon: FileCog, content: '<h1>Official Communiqué</h1><p>To all staff...</p>' },
  { id: 'invoice', name: 'Invoice', icon: Calculator, content: '<h1>Invoice</h1><p><strong>Invoice #:</strong></p><table><tr><th>Item</th><th>Cost</th></tr><tr><td>Service</td><td>$0.00</td></tr></table>' },
  { id: 'certificate', name: 'Certificate', icon: FileText, content: '<h1 style="text-align: center;">Certificate of Achievement</h1><p style="text-align: center;">This is awarded to...</p>' },
  { id: 'letter', name: 'Letter', icon: Building, content: '<p>Dear [Name],</p><p>...</p><p>Sincerely,<br>Signature</p>' },
  { id: 'circular', name: 'School Circular', icon: BookOpen, content: '<h1>School Circular</h1><p>Dear Parents and Guardians,</p><p>...</p>' },
  { id: 'lesson', name: 'Lesson Note', icon: Layout, content: '<h1>Lesson Note</h1><p><strong>Subject:</strong></p><p><strong>Topic:</strong></p><h2>Objectives</h2><ul><li></li></ul>' },
  { id: 'exam', name: 'Exam Paper', icon: GraduationCap, content: '<h1>Examination</h1><p><strong>Course:</strong></p><p><strong>Time Allowed:</strong></p><hr><ol><li>Question 1</li></ol>' },
];

interface TemplateSelectorProps {
  onSelect: (title: string, content: string) => void;
  onClose: () => void;
}

export function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Choose a Template</h2>
            <p className="text-sm text-slate-400">Start with a pre-formatted document</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {templates.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.name === 'Blank Document' ? 'Untitled Document' : t.name, t.content)}
                  className="flex flex-col items-center gap-3 p-6 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-accent rounded-xl transition-all group text-left w-full"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-accent" />
                  </div>
                  <span className="font-semibold text-slate-200 text-center text-sm">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
