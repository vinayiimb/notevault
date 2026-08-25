"use client";
import { useState } from 'react';
import { Bank, CurrencyInr, MagnifyingGlass, Funnel, ArrowSquareOut, SquaresFour, ListDashes } from "@phosphor-icons/react";
import { masterScholarships } from "@/data/scholarships";

export default function MoneyFinderPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  // Filter logic
  const filteredScholarships = masterScholarships.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.eligibility.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProvider = providerFilter === 'All' || s.providerType.includes(providerFilter);
    return matchesSearch && matchesProvider;
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10 sm:py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Section */}
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-sm">
            <Bank size={28} weight="fill" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Money Finder
          </h1>
        </div>
        <p className="text-lg text-muted max-w-3xl leading-relaxed">
          Access all 150+ DU, Government, and Private scholarships in one unified directory. Stop searching through scattered lists and never miss a deadline.
        </p>
      </header>

      {/* Auto-Matcher Profile Banner */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap gap-x-12 gap-y-6">
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Course</p>
            <p className="font-semibold text-foreground">B.Sc Zoology</p>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Family Income</p>
            <p className="font-semibold text-foreground">₹4L - ₹8L / year</p>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Category</p>
            <p className="font-semibold text-foreground">General</p>
          </div>
        </div>
        <button className="whitespace-nowrap rounded-xl bg-brand px-6 py-3 text-sm font-bold text-brand-foreground shadow-sm hover:bg-brand/90 transition-all active:scale-95 w-full md:w-auto text-center">
          Auto-Match My Profile
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        
        <div className="flex flex-1 flex-col sm:flex-row gap-4">
          <div className="relative flex-1 min-w-[280px]">
            <MagnifyingGlass size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" weight="bold" />
            <input 
              type="text" 
              placeholder="Search by name, department, or eligibility..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-full rounded-xl border border-border bg-surface py-3 pl-11 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-brand focus:ring-1 focus:ring-brand shadow-sm"
            />
          </div>
          
          <div className="flex gap-4">
            <select 
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-brand shadow-sm cursor-pointer"
            >
              <option value="All">All Providers</option>
              <option value="Private">Private / CSR</option>
              <option value="Central">Central Govt</option>
              <option value="Delhi">Delhi Govt</option>
              <option value="DU UG">DU Undergrad</option>
              <option value="DU Departmental">DU Departmental</option>
            </select>
            
            <button className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-foreground transition hover:bg-surface-muted shadow-sm">
              <Funnel size={18} /> <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center rounded-xl border border-border bg-surface p-1 shadow-sm shrink-0">
          <button 
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold transition-all ${viewMode === 'grid' ? 'bg-surface-muted text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
          >
            <SquaresFour size={18} weight={viewMode === 'grid' ? "fill" : "regular"} />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button 
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold transition-all ${viewMode === 'table' ? 'bg-surface-muted text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
          >
            <ListDashes size={18} weight={viewMode === 'table' ? "fill" : "regular"} />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>

      </div>

      {/* Results Count */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm font-medium text-muted">
          Showing <span className="font-bold text-foreground">{filteredScholarships.length}</span> scholarships
        </p>
      </div>

      {/* Conditional Rendering: Grid vs Table */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredScholarships.map((scholarship) => {
            let statusColor = "bg-surface-muted text-muted border-border/50";
            let statusDot = "bg-muted";
            
            if (scholarship.status === 'Open') {
              statusColor = "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20";
              statusDot = "bg-green-500";
            } else if (scholarship.status === 'Upcoming' || scholarship.status === 'Watch') {
              statusColor = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
              statusDot = "bg-amber-500";
            } else if (scholarship.status === 'Renewal') {
              statusColor = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
              statusDot = "bg-blue-500";
            }

            return (
              <div key={scholarship.id} className="group flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all hover:shadow-md hover:border-brand/30">
                
                <div className="flex-1 mb-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                      <span className={`size-1.5 rounded-full ${statusDot}`}></span>
                      {scholarship.status}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted truncate">
                      {scholarship.providerType}
                    </span>
                  </div>
                  
                  <h4 className="mb-2.5 text-lg font-bold leading-snug text-foreground group-hover:text-brand transition-colors line-clamp-2" title={scholarship.name}>
                    {scholarship.name}
                  </h4>
                  
                  <p className="text-sm text-muted leading-relaxed line-clamp-3" title={scholarship.eligibility}>
                    {scholarship.eligibility}
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-4 border-t border-border pt-5">
                  {scholarship.department !== 'Any' && (
                    <div className="flex items-start gap-2 text-sm bg-surface-muted/50 rounded-lg p-2.5">
                      <span className="font-bold text-muted uppercase tracking-wider text-[10px] mt-0.5">Dept:</span>
                      <span className="font-medium text-foreground text-xs leading-tight">{scholarship.department}</span>
                    </div>
                  )}
                  
                  <div className="flex items-end justify-between gap-4">
                    <div className="flex items-start gap-1.5 text-sm font-bold text-foreground flex-1">
                      <CurrencyInr size={16} className="shrink-0 mt-0.5 text-muted" /> 
                      <span className="leading-snug line-clamp-2" title={scholarship.benefit}>{scholarship.benefit}</span>
                    </div>
                    
                    <a 
                      href={scholarship.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-brand hover:text-brand-foreground"
                    >
                      Apply <ArrowSquareOut size={14} weight="bold" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-surface-muted border-b border-border">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-muted text-xs">Status</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-muted text-xs">Provider</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-muted text-xs">Scholarship Name</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-muted text-xs">Benefit</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-muted text-xs">Dept</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-muted text-xs text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredScholarships.map((scholarship) => {
                let statusColor = "bg-surface-muted text-muted border-border/50";
                let statusDot = "bg-muted";
                
                if (scholarship.status === 'Open') {
                  statusColor = "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20";
                  statusDot = "bg-green-500";
                } else if (scholarship.status === 'Upcoming' || scholarship.status === 'Watch') {
                  statusColor = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
                  statusDot = "bg-amber-500";
                } else if (scholarship.status === 'Renewal') {
                  statusColor = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
                  statusDot = "bg-blue-500";
                }

                return (
                  <tr key={scholarship.id} className="transition-colors hover:bg-surface-muted/50">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                        <span className={`size-1.5 rounded-full ${statusDot}`}></span>
                        {scholarship.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-muted text-xs uppercase tracking-wider">
                      {scholarship.providerType}
                    </td>
                    <td className="px-6 py-4 max-w-[300px] truncate">
                      <p className="font-bold text-foreground truncate" title={scholarship.name}>{scholarship.name}</p>
                      <p className="text-xs text-muted truncate mt-0.5" title={scholarship.eligibility}>{scholarship.eligibility}</p>
                    </td>
                    <td className="px-6 py-4 font-semibold text-foreground max-w-[200px] truncate">
                      {scholarship.benefit}
                    </td>
                    <td className="px-6 py-4 font-medium text-muted">
                      {scholarship.department !== 'Any' ? scholarship.department : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a 
                        href={scholarship.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-brand hover:text-brand-foreground"
                      >
                        Apply <ArrowSquareOut size={14} weight="bold" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
