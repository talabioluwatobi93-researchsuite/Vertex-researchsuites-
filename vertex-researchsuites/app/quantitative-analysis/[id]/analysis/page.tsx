'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type AnalysisType = 'descriptive' | 'correlation' | 'regression' | 'ttest' | 'anova' | 'chisquare' | 'paired' | 'mannwhitney' | 'wilcoxon' | 'kruskalwallis' | 'twowayanova' | 'mediation' | 'moderation' | 'logistic'
type Construct = { id: string; name: string; role: string; columnIndexes: number[] }

const ANALYSIS_INFO: Record<AnalysisType, { label: string; description: string }> = {
  descriptive: {
    label: 'Descriptive Statistics',
    description: 'Summarizes each construct with Mean, SD, Min, and Max — the foundation for every study.',
  },
  correlation: {
    label: 'Correlation Analysis',
    description: 'Measures the strength and direction of relationships between two or more constructs.',
  },
  regression: {
    label: 'Regression Analysis',
    description: 'Tests how well your Independent Variable(s) predict your Dependent Variable, with a full 4-table output (Variables Entered/Removed, Model Summary, ANOVA, Coefficients).',
  },
  ttest: {
    label: 'Independent Samples T-Test',
    description: 'Compares the mean of a variable between exactly two groups (e.g., Male vs Female), with Levene\u2019s Test and full SPSS-style output.',
  },
  anova: {
    label: 'One-Way ANOVA',
    description: 'Compares the mean of a variable across three or more groups (e.g., Year 1 vs Year 2 vs Year 3), with Tukey HSD post-hoc test and full SPSS-style output.',
  },
  chisquare: {
    label: 'Chi-Square Test of Independence',
    description: 'Tests whether two categorical variables are related (e.g., Gender vs Preferred Study Mode), with a full Crosstab and Chi-Square Tests table.',
  },
  paired: {
    label: 'Paired-Samples T-Test',
    description: 'Compares two measurements taken from the SAME people (e.g., a before score and an after score), to see if there was a real change.',
  },
  mannwhitney: {
    label: 'Mann-Whitney U Test',
    description: 'Compares two independent groups when your data is not normally distributed - a safer alternative to the T-Test for ranked or skewed scores.',
  },
  wilcoxon: {
    label: 'Wilcoxon Signed-Rank Test',
    description: 'Compares two measurements from the SAME people when your data is not normally distributed - a safer alternative to the Paired T-Test.',
  },
  kruskalwallis: {
    label: 'Kruskal-Wallis Test',
    description: 'Compares three or more independent groups when your data is not normally distributed - a safer alternative to One-Way ANOVA.',
  },
  twowayanova: {
    label: 'Two-Way ANOVA',
    description: 'Tests the effect of TWO grouping variables on an outcome at once (e.g., Gender AND Year Level on Exam Score), plus whether they interact.',
  },
  mediation: {
    label: 'Mediation Analysis (Sobel Test)',
    description: 'Tests whether the effect of one variable on another happens THROUGH a third, in-between variable (e.g., does Study Habits explain why Motivation affects Grades?).',
  },
  moderation: {
    label: 'Moderation Analysis',
    description: 'Tests whether the strength of the relationship between two variables CHANGES depending on a third variable (e.g., does the Motivation-to-Grades link get stronger or weaker depending on Age?).',
  },
  logistic: {
    label: 'Logistic Regression',
    description: 'Predicts a YES/NO outcome (e.g., Pass vs Fail) from one or more variables, rather than a numeric score.',
  },
}

export default function AnalysisTypePage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [constructs, setConstructs] = useState<Construct[]>([])
  const [selected, setSelected] = useState<AnalysisType[]>([])
  const [modelConfirmed, setModelConfirmed] = useState(false)

  const [rawData, setRawData] = useState<any[][]>([])
  const [ttestGroupId, setTtestGroupId] = useState('')
  const [ttestOutcomeId, setTtestOutcomeId] = useState('')
  const [anovaGroupId, setAnovaGroupId] = useState('')
  const [anovaOutcomeId, setAnovaOutcomeId] = useState('')
  const [chisquareRowId, setChisquareRowId] = useState('')
  const [chisquareColId, setChisquareColId] = useState('')
  const [includeSpearman, setIncludeSpearman] = useState(false)
  const [tailType, setTailType] = useState<'two' | 'one'>('two')
  const [pairedGroup1Id, setPairedGroup1Id] = useState('')
  const [pairedGroup2Id, setPairedGroup2Id] = useState('')
  const [mannwhitneyGroupId, setMannwhitneyGroupId] = useState('')
  const [mannwhitneyOutcomeId, setMannwhitneyOutcomeId] = useState('')
  const [wilcoxonGroup1Id, setWilcoxonGroup1Id] = useState('')
  const [wilcoxonGroup2Id, setWilcoxonGroup2Id] = useState('')
  const [kruskalGroupId, setKruskalGroupId] = useState('')
  const [kruskalOutcomeId, setKruskalOutcomeId] = useState('')
  const [twowayFactorAId, setTwowayFactorAId] = useState('')
  const [twowayFactorBId, setTwowayFactorBId] = useState('')
  const [twowayOutcomeId, setTwowayOutcomeId] = useState('')
  const [mediationPredictorId, setMediationPredictorId] = useState('')
  const [mediationMediatorId, setMediationMediatorId] = useState('')
  const [mediationOutcomeId, setMediationOutcomeId] = useState('')
  const [moderationPredictorId, setModerationPredictorId] = useState('')
  const [moderationModeratorId, setModerationModeratorId] = useState('')
  const [moderationOutcomeId, setModerationOutcomeId] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('quantitative_analysis_sessions')
        .select('constructs, analysis_type, raw_data, ttest_config, anova_config, chisquare_config, paired_config, mannwhitney_config, wilcoxon_config, kruskalwallis_config, twowayanova_config, mediation_config, moderation_config')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        setErrorMsg('Could not load this session. Please go back and complete column mapping first.')
        setLoading(false)
        return
      }

      setConstructs(data.constructs || [])
      setRawData(data.raw_data || [])
      if (data.analysis_type && Array.isArray(data.analysis_type)) {
        setSelected(data.analysis_type)
      }
      if (data.ttest_config) {
        setTtestGroupId(data.ttest_config.groupConstructId || '')
        setTtestOutcomeId(data.ttest_config.outcomeConstructId || '')
      }
      if (data.anova_config) {
        setAnovaGroupId(data.anova_config.groupConstructId || '')
        setAnovaOutcomeId(data.anova_config.outcomeConstructId || '')
      }
      if (data.chisquare_config) {
        setChisquareRowId(data.chisquare_config.rowConstructId || '')
        setChisquareColId(data.chisquare_config.colConstructId || '')
      }
      if (data.paired_config) {
        setPairedGroup1Id(data.paired_config.group1ConstructId || '')
        setPairedGroup2Id(data.paired_config.group2ConstructId || '')
      }
      if (data.mannwhitney_config) {
        setMannwhitneyGroupId(data.mannwhitney_config.groupConstructId || '')
        setMannwhitneyOutcomeId(data.mannwhitney_config.outcomeConstructId || '')
      }
      if (data.wilcoxon_config) {
        setWilcoxonGroup1Id(data.wilcoxon_config.group1ConstructId || '')
        setWilcoxonGroup2Id(data.wilcoxon_config.group2ConstructId || '')
      }
      if (data.kruskalwallis_config) {
        setKruskalGroupId(data.kruskalwallis_config.groupConstructId || '')
        setKruskalOutcomeId(data.kruskalwallis_config.outcomeConstructId || '')
      }
      if (data.twowayanova_config) {
        setTwowayFactorAId(data.twowayanova_config.factorAConstructId || '')
        setTwowayFactorBId(data.twowayanova_config.factorBConstructId || '')
        setTwowayOutcomeId(data.twowayanova_config.outcomeConstructId || '')
      }
      if (data.mediation_config) {
        setMediationPredictorId(data.mediation_config.predictorConstructId || '')
        setMediationMediatorId(data.mediation_config.mediatorConstructId || '')
        setMediationOutcomeId(data.mediation_config.outcomeConstructId || '')
      }
      if (data.moderation_config) {
        setModerationPredictorId(data.moderation_config.predictorConstructId || '')
        setModerationModeratorId(data.moderation_config.moderatorConstructId || '')
        setModerationOutcomeId(data.moderation_config.outcomeConstructId || '')
      }
      setLoading(false)
    }
    load()
  }, [sessionId])

  const ivConstructs = constructs.filter((c) => c.role === 'IV')
  const dvConstructs = constructs.filter((c) => c.role === 'DV')
  const ivCount = ivConstructs.length
  const dvCount = dvConstructs.length
  const hasDemographic = constructs.some((c) => c.role === 'Demographic')

  // A construct is eligible as a t-test grouping variable only if it uses
  // exactly ONE column (matches SPSS: every variable is a single column)
  // AND that column has exactly 2 distinct non-empty values in the data.
  function getDistinctValues(colIndex: number): string[] {
    const seen = new Set<string>()
    rawData.forEach((row) => {
      const val = row[colIndex]
      if (val === null || val === undefined || String(val).trim() === '') return
      seen.add(String(val).trim())
    })
    return Array.from(seen)
  }

  const groupEligibleConstructs = constructs
    .filter((c) => c.columnIndexes && c.columnIndexes.length === 1)
    .map((c) => ({ ...c, distinctValues: getDistinctValues(c.columnIndexes[0]) }))
    .filter((c) => c.distinctValues.length === 2)

  // Outcome variable for t-test: any construct NOT chosen as the grouping variable
  const outcomeEligibleConstructs = constructs.filter((c) => c.id !== ttestGroupId)

  // A construct is eligible as an ANOVA grouping variable if it uses exactly ONE
  // column AND that column has 3 or more distinct non-empty values in the data.
  const groupEligibleConstructsAnova = constructs
    .filter((c) => c.columnIndexes && c.columnIndexes.length === 1)
    .map((c) => ({ ...c, distinctValues: getDistinctValues(c.columnIndexes[0]) }))
    .filter((c) => c.distinctValues.length >= 3)

  const outcomeEligibleConstructsAnova = constructs.filter((c) => c.id !== anovaGroupId)

  // Scale/numeric constructs usable as a Predictor/Mediator/Moderator/Outcome/
  // paired-measurement (anything that isn't Demographic and has data mapped to it)
  const numericEligibleConstructs = constructs.filter((c) => c.role !== 'Demographic' && c.columnIndexes && c.columnIndexes.length > 0)

  // A binary DV (exactly 2 distinct values) is required for logistic regression
  const binaryDvConstructs = dvConstructs.filter((c) => c.columnIndexes && c.columnIndexes.length === 1 && getDistinctValues(c.columnIndexes[0]).length === 2)

  // A construct is eligible for Chi-Square if it uses exactly ONE column
  // AND that column has 2 or more distinct non-empty values in the data.
  const chisquareEligibleConstructs = constructs
    .filter((c) => c.columnIndexes && c.columnIndexes.length === 1)
    .map((c) => ({ ...c, distinctValues: getDistinctValues(c.columnIndexes[0]) }))
    .filter((c) => c.distinctValues.length >= 2)

  const chisquareColEligibleConstructs = chisquareEligibleConstructs.filter((c) => c.id !== chisquareRowId)

  const availability: Record<AnalysisType, { available: boolean; reason: string }> = {
    descriptive: {
      available: constructs.length > 0,
      reason: 'No constructs found. Please complete column mapping first.',
    },
    correlation: {
      available: constructs.filter((c) => c.role === 'IV' || c.role === 'DV').length >= 2,
      reason: 'Need at least 2 IV/DV constructs to correlate.',
    },
    regression: {
      available: ivCount >= 1 && dvCount === 1,
      reason: 'Need at least 1 Independent Variable and exactly 1 Dependent Variable.',
    },
    ttest: {
      available: groupEligibleConstructs.length > 0 && constructs.length >= 2,
      reason: 'Need a single-column variable with exactly 2 distinct values (e.g., Gender) to group by.',
    },
    anova: {
      available: groupEligibleConstructsAnova.length > 0 && constructs.length >= 2,
      reason: 'Need a single-column variable with 3 or more distinct values (e.g., Year Level) to group by.',
    },
    chisquare: {
      available: chisquareEligibleConstructs.length >= 2,
      reason: 'Need at least 2 categorical, single-column variables with 2 or more distinct values each.',
    },
    paired: {
      available: numericEligibleConstructs.length >= 2,
      reason: 'Need at least 2 scale variables representing the same measurement taken twice (e.g., Pre-Test Score and Post-Test Score).',
    },
    mannwhitney: {
      available: groupEligibleConstructs.length > 0 && constructs.length >= 2,
      reason: 'Need a single-column variable with exactly 2 distinct values (e.g., Gender) to group by.',
    },
    wilcoxon: {
      available: numericEligibleConstructs.length >= 2,
      reason: 'Need at least 2 scale variables representing the same measurement taken twice (e.g., Pre-Test Score and Post-Test Score).',
    },
    kruskalwallis: {
      available: groupEligibleConstructsAnova.length > 0 && constructs.length >= 2,
      reason: 'Need a single-column variable with 3 or more distinct values (e.g., Year Level) to group by.',
    },
    twowayanova: {
      available: groupEligibleConstructsAnova.length + groupEligibleConstructs.length >= 2 && constructs.length >= 3,
      reason: 'Need at least 2 separate grouping variables (each with 2 or more distinct values, e.g., Gender AND Year Level) plus a numeric outcome.',
    },
    mediation: {
      available: numericEligibleConstructs.length >= 3,
      reason: 'Need at least 3 distinct scale variables: a Predictor, a Mediator (the in-between variable), and an Outcome.',
    },
    moderation: {
      available: numericEligibleConstructs.length >= 3,
      reason: 'Need at least 3 distinct scale variables: a Predictor, a Moderator (the variable that changes the relationship), and an Outcome.',
    },
    logistic: {
      available: ivCount >= 1 && binaryDvConstructs.length >= 1,
      reason: 'Need at least 1 Independent Variable and a Dependent Variable with exactly 2 outcomes (e.g., Pass/Fail).',
    },
  }

  function toggleType(type: AnalysisType) {
    setSelected((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
    setErrorMsg('')
  }

  async function handleContinue() {
    if (selected.length === 0) {
      setErrorMsg('Please select at least one analysis type.')
      return
    }

    if (selected.includes('regression') && !modelConfirmed) {
      setErrorMsg('Please confirm your regression model before continuing.')
      return
    }

    if (selected.includes('ttest')) {
      if (!ttestGroupId) {
        setErrorMsg('Please choose a grouping variable for the t-test (must have exactly 2 groups).')
        return
      }
      if (!ttestOutcomeId) {
        setErrorMsg('Please choose an outcome variable for the t-test.')
        return
      }
    }

    if (selected.includes('anova')) {
      if (!anovaGroupId) {
        setErrorMsg('Please choose a grouping variable for the ANOVA (must have 3 or more groups).')
        return
      }
      if (!anovaOutcomeId) {
        setErrorMsg('Please choose an outcome variable for the ANOVA.')
        return
      }
    }

    if (selected.includes('chisquare')) {
      if (!chisquareRowId) {
        setErrorMsg('Please choose the first variable for the Chi-Square test.')
        return
      }
      if (!chisquareColId) {
        setErrorMsg('Please choose the second variable for the Chi-Square test.')
        return
      }
    }

    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase
      .from('quantitative_analysis_sessions')
      .update({
        analysis_type: selected,
        ttest_config: selected.includes('ttest')
          ? { groupConstructId: ttestGroupId, outcomeConstructId: ttestOutcomeId }
          : null,
        anova_config: selected.includes('anova')
          ? { groupConstructId: anovaGroupId, outcomeConstructId: anovaOutcomeId }
          : null,
        chisquare_config: selected.includes('chisquare')
          ? { rowConstructId: chisquareRowId, colConstructId: chisquareColId }
          : null,
        correlation_config: selected.includes('correlation')
          ? { includeSpearman, tailType }
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) {
      setErrorMsg('Something went wrong saving your analysis selection. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/quantitative-analysis/${sessionId}/sections`)
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ color: '#777777', fontSize: '14px' }}>Loading your data...</p>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '24px 20px' }}>
      <h1 style={{ color: '#333333', fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>
        Choose Your Analysis
      </h1>
      <p style={{ color: '#777777', fontSize: '13px', marginBottom: '20px' }}>
        Step 8 of 10 — Based on your constructs, select the type(s) of analysis you need. You can choose more than one.
      </p>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
        <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Your Constructs</p>
        <p style={{ color: '#777777', fontSize: '12px', margin: 0 }}>
          {ivCount} Independent Variable{ivCount !== 1 ? 's' : ''} &middot; {dvCount} Dependent Variable{dvCount !== 1 ? 's' : ''}
          {hasDemographic ? ' \u00b7 Demographics included' : ''}
        </p>
      </div>

      {Object.keys(ANALYSIS_INFO).map((type) => {
        const info = ANALYSIS_INFO[type as AnalysisType]
        const avail = availability[type as AnalysisType]
        const isSelected = selected.includes(type as AnalysisType)

        return (
          <div
            key={type}
            onClick={() => toggleType(type as AnalysisType)}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '16px',
              border: isSelected ? '2px solid #D4AF37' : '1px solid #EEEEEE',
              marginBottom: '12px',
              opacity: avail.available ? 1 : 0.5,
              cursor: avail.available ? 'pointer' : 'not-allowed',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <p style={{ color: '#333333', fontSize: '14px', fontWeight: 700, margin: 0 }}>{info.label}</p>
              <input
                type="checkbox"
                checked={isSelected}
                disabled={!avail.available}
                onChange={() => toggleType(type as AnalysisType)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <p style={{ color: '#777777', fontSize: '12px', margin: 0 }}>
              {avail.available ? info.description : avail.reason}
            </p>

            {type === 'correlation' && isSelected && avail.available && (
              <div style={{ backgroundColor: '#F9F9F9', borderRadius: '10px', padding: '10px 12px', marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                <p style={{ color: '#333333', fontSize: '12px', margin: 0 }}>
                  We'll correlate: {[...ivConstructs, ...dvConstructs].map((c) => c.name).join(', ')}
                </p>
                  <p style={{ color: '#333333', fontSize: '12px', margin: '10px 0 4px 0' }}>
                    Pearson correlation runs by default. Only turn on Spearman if your data is ranked/ordinal or you specifically need a non-parametric test.
                  </p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <input
                      type="checkbox"
                      checked={includeSpearman}
                      onChange={(e) => setIncludeSpearman(e.target.checked)}
                    />
                    <span style={{ color: '#555555', fontSize: '12px' }}>Also run Spearman's rank correlation (optional)</span>
                  </label>
                  <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Significance test
                  </label>
                  <select
                    value={tailType}
                    onChange={(e) => setTailType(e.target.value as 'two' | 'one')}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333' }}
                  >
                    <option value="two">Two-tailed (default - use this unless you're sure)</option>
                    <option value="one">One-tailed (only if your hypothesis predicts a direction, e.g. "X increases Y")</option>
                  </select>
                  <p style={{ color: '#777777', fontSize: '11px', margin: '6px 0 0 0' }}>
                    Not sure? Stick with two-tailed - it's the safer, standard choice for most student research and doesn't assume a direction of effect.
                  </p>
              </div>
            )}

            {type === 'regression' && isSelected && avail.available && (
              <div style={{ backgroundColor: '#F9F9F9', borderRadius: '10px', padding: '10px 12px', marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                <p style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                  We'll test whether {ivConstructs.map((c) => c.name).join(' and ')} predict{ivConstructs.length === 1 ? 's' : ''} {dvConstructs[0]?.name}.
                </p>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <input type="checkbox" checked={modelConfirmed} onChange={(e) => setModelConfirmed(e.target.checked)} style={{ marginTop: '2px' }} />
                  <span style={{ color: '#555555', fontSize: '12px' }}>Yes, this is correct.</span>
                </label>
              </div>
            )}

            {type === 'ttest' && isSelected && avail.available && (
              <div style={{ backgroundColor: '#F9F9F9', borderRadius: '10px', padding: '12px', marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  Grouping variable (must have exactly 2 groups)
                </label>
                <select
                  value={ttestGroupId}
                  onChange={(e) => { setTtestGroupId(e.target.value); if (ttestOutcomeId === e.target.value) setTtestOutcomeId('') }}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333', marginBottom: '10px' }}
                >
                  <option value="">Select a grouping variable...</option>
                  {groupEligibleConstructs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.distinctValues.join(' vs ')})</option>
                  ))}
                </select>

                <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  Outcome variable (what you're comparing)
                </label>
                <select
                  value={ttestOutcomeId}
                  onChange={(e) => setTtestOutcomeId(e.target.value)}
                  disabled={!ttestGroupId}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333' }}
                >
                  <option value="">Select an outcome variable...</option>
                  {outcomeEligibleConstructs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {ttestGroupId && ttestOutcomeId && (
                  <p style={{ color: '#777777', fontSize: '11px', marginTop: '8px', marginBottom: 0 }}>
                    We'll compare {outcomeEligibleConstructs.find((c) => c.id === ttestOutcomeId)?.name} between the two groups of {groupEligibleConstructs.find((c) => c.id === ttestGroupId)?.name}.
                  </p>
                )}
              </div>
            )}

            {type === 'anova' && isSelected && avail.available && (
              <div style={{ backgroundColor: '#F9F9F9', borderRadius: '10px', padding: '12px', marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  Grouping variable (must have 3 or more groups)
                </label>
                <select
                  value={anovaGroupId}
                  onChange={(e) => { setAnovaGroupId(e.target.value); if (anovaOutcomeId === e.target.value) setAnovaOutcomeId('') }}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333', marginBottom: '10px' }}
                >
                  <option value="">Select a grouping variable...</option>
                  {groupEligibleConstructsAnova.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.distinctValues.join(', ')})</option>
                  ))}
                </select>

                <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  Outcome variable (what you're comparing)
                </label>
                <select
                  value={anovaOutcomeId}
                  onChange={(e) => setAnovaOutcomeId(e.target.value)}
                  disabled={!anovaGroupId}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333' }}
                >
                  <option value="">Select an outcome variable...</option>
                  {outcomeEligibleConstructsAnova.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {anovaGroupId && anovaOutcomeId && (
                  <p style={{ color: '#777777', fontSize: '11px', marginTop: '8px', marginBottom: 0 }}>
                    We'll compare {outcomeEligibleConstructsAnova.find((c) => c.id === anovaOutcomeId)?.name} across the groups of {groupEligibleConstructsAnova.find((c) => c.id === anovaGroupId)?.name}.
                  </p>
                )}
              </div>
            )}

            {type === 'chisquare' && isSelected && avail.available && (
              <div style={{ backgroundColor: '#F9F9F9', borderRadius: '10px', padding: '12px', marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  First variable
                </label>
                <select
                  value={chisquareRowId}
                  onChange={(e) => { setChisquareRowId(e.target.value); if (chisquareColId === e.target.value) setChisquareColId('') }}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333', marginBottom: '10px' }}
                >
                  <option value="">Select a variable...</option>
                  {chisquareEligibleConstructs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.distinctValues.join(', ')})</option>
                  ))}
                </select>

                <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  Second variable
                </label>
                <select
                  value={chisquareColId}
                  onChange={(e) => setChisquareColId(e.target.value)}
                  disabled={!chisquareRowId}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333' }}
                >
                  <option value="">Select a variable...</option>
                  {chisquareColEligibleConstructs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.distinctValues.join(', ')})</option>
                  ))}
                </select>

                {chisquareRowId && chisquareColId && (
                  <p style={{ color: '#777777', fontSize: '11px', marginTop: '8px', marginBottom: 0 }}>
                    We'll test whether {chisquareEligibleConstructs.find((c) => c.id === chisquareRowId)?.name} and {chisquareEligibleConstructs.find((c) => c.id === chisquareColId)?.name} are related.
                  </p>
                )}
              </div>
            )}
          {type === 'paired' && isSelected && avail.available && (
            <div style={{ backgroundColor: '#F9F9F9', borderRadius: '10px', padding: '12px', marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
              <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>First measurement (e.g., Pre-Test Score)</label>
              <select value={pairedGroup1Id} onChange={(e) => { setPairedGroup1Id(e.target.value); if (pairedGroup2Id === e.target.value) setPairedGroup2Id('') }} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333', marginBottom: '10px' }}>
                <option value="">Select a variable...</option>
                {numericEligibleConstructs.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Second measurement (e.g., Post-Test Score)</label>
              <select value={pairedGroup2Id} onChange={(e) => setPairedGroup2Id(e.target.value)} disabled={!pairedGroup1Id} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333' }}>
                <option value="">Select a variable...</option>
                {numericEligibleConstructs.filter((c) => c.id !== pairedGroup1Id).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              {pairedGroup1Id && pairedGroup2Id && (
                <p style={{ color: '#777777', fontSize: '11px', marginTop: '8px', marginBottom: 0 }}>We will compare {numericEligibleConstructs.find((c) => c.id === pairedGroup1Id)?.name} against {numericEligibleConstructs.find((c) => c.id === pairedGroup2Id)?.name} for the same people.</p>
              )}
            </div>
          )}

          {type === 'mannwhitney' && isSelected && avail.available && (
            <div style={{ backgroundColor: '#F9F9F9', borderRadius: '10px', padding: '12px', marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
              <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Grouping variable (must have exactly 2 groups)</label>
              <select value={mannwhitneyGroupId} onChange={(e) => { setMannwhitneyGroupId(e.target.value); if (mannwhitneyOutcomeId === e.target.value) setMannwhitneyOutcomeId('') }} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333', marginBottom: '10px' }}>
                <option value="">Select a grouping variable...</option>
                {groupEligibleConstructs.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.distinctValues.join(' vs ')})</option>))}
              </select>
              <label style={{ color: '#333333', fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Outcome variable (what you are comparing)</label>
              <select value={mannwhitneyOutcomeId} onChange={(e) => setMannwhitneyOutcomeId(e.target.value)} disabled={!mannwhitneyGroupId} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '12px', color: '#333333' }}>
                <option value="">Select an outcome variable...</option>
                {constructs.filter((c) => c.id !== mannwhitneyGroupId).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              {mannwhitneyGroupId && mannwhitneyOutcomeId && (
                <p style={{ color: '#777777', fontSize: '11px', marginTop: '8px', marginBottom: 0 }}>We will compare {constructs.find((c) => c.id === mannwhitneyOutcomeId)?.name} between the two groups of {groupEligibleConstructs.find((c) => c.id === mannwhitneyGroupId)?.name}.</p>
              )}
            </div>
          )}
          </div>
        )
      })}

      {errorMsg && (
        <div style={{ backgroundColor: '#FDECEC', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ color: '#C0392B', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
        </div>
      )}

      <button
        onClick={handleContinue}
        disabled={saving}
        style={{
          width: '100%',
          backgroundColor: '#D4AF37',
          color: '#333333',
          border: 'none',
          borderRadius: '10px',
          padding: '14px',
          fontSize: '14px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {saving ? 'Saving...' : 'Continue to Section Mapping'}
      </button>
    </div>
  )
}
