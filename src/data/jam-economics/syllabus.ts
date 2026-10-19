// Official IIT JAM 2027 Economics (EN) syllabus, as published.
// `unit` matches the unit tags used in the <year>.md question files.

export const JAM_EN_SYLLABUS: { unit: string; title: string; parts: { heading: string; text: string }[] }[] = [
  {
    unit: "Mathematics",
    title: "Mathematics for Economics",
    parts: [
      {
        heading: "Preliminaries and functions",
        text: "Set theory and number systems; monotonicity and inverse functions; elementary functions: quadratic, polynomial, power, exponential, logarithmic; logarithms and elasticities (log-derivative interpretation); functions of several variables; graphs and level curves; convex set; concavity and quasi-concavity of function; convexity and quasi-convexity of functions; sequences and series: convergence, algebraic properties and applications (including geometric series and basic limits of sequences).",
      },
      {
        heading: "Differential calculus",
        text: "Limits, continuity and differentiability; mean value theorems; Taylor's theorem; partial differentiation; gradient; chain rule; second and higher order derivatives: properties and applications; Hessian; implicit function theorem and application to comparative statics problems; homogeneous and homothetic functions: characterisations and applications.",
      },
      { heading: "Integral calculus", text: "Definite integrals, fundamental theorems, indefinite integrals and applications." },
      {
        heading: "Differential equations, and difference equations",
        text: "First order ordinary equations with applications; steady state/equilibrium and basic stability (including simple phase-diagram intuition where relevant).",
      },
      {
        heading: "Linear algebra",
        text: "Matrix representations and elementary operations; systems of linear equations: properties of their solution; linear independence and dependence; rank; determinants; matrix inverse and conditions for invertibility; eigenvectors and eigenvalues of square matrices (primarily 2x2); basic diagonalization idea (simple cases); symmetric matrices and quadratic forms; definiteness and semidefiniteness of quadratic forms and interpretation stability.",
      },
      {
        heading: "Optimization",
        text: "Local and global optima: geometric and calculus-based characterisations and applications; multivariate optimization; use of quadratic forms, Hessians in optimization; constrained optimization (equality constraints) and method of Lagrange multiplier; constrained optimization with inequality constraints: Karush-Kuhn–Tucker (KKT) conditions and complementary slackness (basic form and applications); second order conditions of optima; definiteness and optimality; properties of value function: envelope theorem and applications; linear programming: graphical solution, matrix formulation, duality, economic interpretation.",
      },
    ],
  },
  {
    unit: "Statistics",
    title: "Statistics for Economics",
    parts: [
      {
        heading: "Descriptive Statistics",
        text: "Different types of Charts and diagrams; Frequency Distribution; Measures of Central Tendency; Measures of Dispersion; Moments, Skewness, Kurtosis; Index Numbers.",
      },
      {
        heading: "Probability Theory",
        text: "Random experiment, events, and sample space; Classical and axiomatic definitions of probability; Theorems of probability; Repeated trials and drawing with and without replacement; Conditional probability, independent events, and Bayes' theorem; Random variable and its probability distribution; Markov's inequality; Chebyshev's inequality; Expectation, variance, and other higher order moments of a random variable; Moment Generating Function; Bernoulli trials; Binomial, Poisson, Hypergeometric, Uniform, and Normal distributions with concepts of probability mass and probability density functions; Chi-square, Student's t-, and F-distributions, with their relation with Normal distribution; Joint distribution of random variables, conditional distributions, and their properties.",
      },
      {
        heading: "Mathematical Statistics",
        text: "Random sampling and its different types; Concept of sampling distribution; Method of Estimation with the concepts of estimator and estimate; Confidence intervals vs. point and interval estimations; Properties of Estimators: Unbiasedness, Efficiency, and Consistency; Law of Large Numbers and Central Limit Theorem.",
      },
      {
        heading: "Hypothesis Testing",
        text: "Concepts of Parameter vs. statistic; Null and Alternative Hypotheses; Concepts of test statistic and its distribution; Concept of p-value; Type I and Type II errors and computation of their probabilities; Size and Power of a test; Comparing two population characteristics on the basis of randomly drawn samples from them.",
      },
      {
        heading: "Correlation and Regression",
        text: "Correlation and types of correlation; Nature of regression analysis; Method of Ordinary Least Squares (OLS) vis-à-vis Method of Moments vis-à-vis Maximum Likelihood estimations; CLRM assumptions, statistical properties of OLS estimators and hypothesis testing; Gauss-Markov Theorem and concept of Best Linear Unbiased Estimator (BLUE); Goodness of fit.",
      },
    ],
  },
  {
    unit: "Microeconomics",
    title: "Microeconomics",
    parts: [
      {
        heading: "Consumer theory",
        text: "Preferences, utility and representation theorem; budget constraint; choice; demand (ordinary and compensated); demand elasticities; Slutsky equation; revealed preference axioms.",
      },
      {
        heading: "Theory of production and cost",
        text: "Production technology; short run and long run; production functions with one and more inputs; isoquants; returns to scale; short run and long run costs; cost curves in the short run and long run.",
      },
      {
        heading: "Perfect competition and partial equilibrium",
        text: "Profit maximization; individual and market supply; market equilibrium; consumer and producer surplus; government intervention in perfectly competitive markets: commodity taxes, subsidies, MSP, price ceilings and floors.",
      },
      {
        heading: "General equilibrium and welfare",
        text: "Equilibrium and efficiency under pure exchange and production; the two theorems of welfare economics.",
      },
      {
        heading: "Introductory Game theory",
        text: "Strategic-form games; dominant and dominated strategies; iterated elimination of dominated strategies; best response; pure and mixed strategy Nash equilibrium; sequential-move games (finite horizon); backward induction; subgame perfect equilibrium.",
      },
      {
        heading: "Imperfect competition and market structure",
        text: "Monopoly; pricing with market power; price discrimination (first, second and third degrees); monopolistic competition; oligopoly models—Cournot, Bertrand and Stackelberg.",
      },
      {
        heading: "Market failure and government policy",
        text: "Externalities (Pigouvian taxes and subsidies); public goods (Samuelson condition, Lindahl pricing); asymmetric information: adverse selection and moral hazard (basic notions).",
      },
    ],
  },
  {
    unit: "Macroeconomics",
    title: "Macroeconomics",
    parts: [
      {
        heading: "National income accounting",
        text: "Key concepts and measurement; circular flow of income (closed and open economy); nominal vs real GDP; GDP deflator; GDP and welfare.",
      },
      {
        heading: "Consumption and saving",
        text: "Keynesian consumption (short run and long run); absolute income, permanent income and life-cycle hypotheses; two-period model of consumption.",
      },
      { heading: "Production Function", text: "Cobb-Douglas Production Function, Total Factor Productivity, Technological Progress, Return to Scale, Cost Functions." },
      {
        heading: "Labour Demand, Labour Supply, Investment",
        text: "Profit Maximization under Perfect Competition, Labour Demand, Capital Demand and Investment, Labour Supply through Consumption-Leisure Framework, Structural, Frictional and Search Unemployment, Unemployment Rate, Aggregate Supply/Lucas Supply Curve.",
      },
      {
        heading: "Unemployment and Inflation",
        text: "CPI/Cost of Living Index, Inflation Rate, Causes and Costs of Inflation, Aggregate Supply/Lucas Supply Curve and Phillips Curve.",
      },
      {
        heading: "Money Supply and Money Demand",
        text: "Definition and roles of money; monetary Base; fiat vs. commodity money, fractional reserve banking, balance Sheet of Central Bank and commercial banks, money supply, deposit creation, money multiplier, monetary policy Tools (open market operations, reserve requirements, discount rate); quantity theory of money, Keynesian liquidity preference theory, Baumol-Tobin Model, Tobin's speculative demand for money; seigniorage; optimal monetary policy (rules vs. discretion).",
      },
      {
        heading: "Asset Pricing",
        text: "Bonds, and Stock Pricing, Gordon Growth Model of Stocks Price, Tobin's q and Investment, Risk Structure and Term Structure of Interest Rate, Yield Curve.",
      },
      {
        heading: "Fiscal policy (based on two-period models)",
        text: "Government budget constraint; revenues, expenditures and deficits; distortionary vs non-distortionary taxes; Laffer curve; Ricardian equivalence.",
      },
      {
        heading: "Income determination and policy in the short run",
        text: "Goods and money market equilibrium; IS–LM; classical vs Keynesian models; aggregate demand; fiscal and monetary multipliers; liquidity trap/zero lower bound; Fisher equation and real interest rate; Taylor rule and principle; simple dynamic AD–AS and stability.",
      },
      {
        heading: "Long-run growth",
        text: "Stylized facts, Kaldor facts; Harrod–Domar model; Solow model with population and technology growth; convergence (conditional/absolute); golden rule; dynamic inefficiency of Solow model; growth accounting and Solow residual; endogenous growth (AK model); poverty trap.",
      },
      {
        heading: "Open economy macroeconomics",
        text: "GNP; Balance of payments (trade balance, current account, financial account); current account in an intertemporal (two-period) framework; nominal and real exchange rates; fixed, flexible and dirty floating exchange rates; interest parity and capital market integration; impossible trinity; purchasing power parity, Big Mac index, PPP-adjusted exchange rate; Mundell–Fleming model.",
      },
    ],
  },
  {
    unit: "Indian Economy",
    title: "Indian Economy",
    parts: [
      {
        heading: "Introduction and features",
        text: "Changing structure of the Indian economy. Changing paradigms of Development Strategies and Economic Reforms.",
      },
      {
        heading: "Poverty, Inequality, Inflation and Unemployment",
        text: "Various concepts and estimates of poverty; Income inequality; Problem of unemployment; Interface between growth, poverty and employment; Inclusive growth and Human Development; Sustainable Development Goals—Targets for Decent Employment, reduction in Poverty, and Inequality. Inflation targeting and use of monetary and fiscal policy.",
      },
      {
        heading: "Demographic Issues",
        text: "Demographic trends, size and structure of population; Health and Education; Skill challenges and demographic dividends; Sustainable Development Goals—Targets for Greater Wellbeing and Better Human Capital.",
      },
      {
        heading: "Perspectives in Agriculture, Industry and Services",
        text: "Agricultural growth performance and food security, Industrial investment and growth, Service sector in India's growth process.",
      },
      {
        heading: "External Sector and Issues in Indian Public Finance",
        text: "Foreign trade and trade policy; Foreign Exchange Reserves and exchange rate, Indian Union Budget and fiscal policy.",
      },
    ],
  },
];
