/* M 105 (with M 005): topic notes, formulas, flashcards, practice sets and checklists.
   Written for StudyCat from standard quantitative reasoning (units and percentages, large numbers, linear and
   exponential relations, financial mathematics, probability and statistics), following the course description and
   learning outcomes in the Fall 2026 syllabus. The class notes packet, MyOpenMath and the worksheets decide what
   the tests ask. Money is written \$ so it is not read as math. */
const R = String.raw;

const SECTIONS = [
  /* ---------- Unit 1: numbers in context ---------- */
  { id: 'units', label: '1.1', title: 'Units and unit conversions', unit: 1,
    ideas: [
      R`Units tell you what a number means. Read <b>per</b> as "divided by" (miles per hour is $\text{mi}/\text{hr}$) and <b>of</b> with a fraction or percent as "times".`,
      R`A <b>conversion factor</b> is a fraction equal to 1, like $\frac{12\text{ in}}{1\text{ ft}}$ or $\frac{1\text{ ft}}{12\text{ in}}$. Pick the one that puts the unit you want to get rid of on the opposite side, so it cancels.`,
      R`Chain factors for multi-step conversions: $60\ \frac{\text{mi}}{\text{hr}}\times\frac{5280\text{ ft}}{1\text{ mi}}\times\frac{1\text{ hr}}{3600\text{ s}} = 88\ \frac{\text{ft}}{\text{s}}$.`,
      R`<b>Square and cubic units</b> need the factor squared or cubed: $1\text{ yd}^2 = (3\text{ ft})^2 = 9\text{ ft}^2$ and $1\text{ yd}^3 = 27\text{ ft}^3$.`,
      R`Metric prefixes: kilo $=1000$, centi $=\frac1{100}$, milli $=\frac1{1000}$. Bridges between systems: $1\text{ in} = 2.54\text{ cm}$, $1\text{ mi}\approx1.609\text{ km}$, $1\text{ kg}\approx2.205\text{ lb}$, $1\text{ L}\approx1.057\text{ qt}$.`,
      R`Rates chain the same way: the gas cost of a trip is $\text{miles}\times\frac{1\text{ gal}}{\text{miles per gallon}}\times\frac{\text{price}}{1\text{ gal}}$. If the units cancel to dollars, the setup is right.`
    ],
    formulas: [{ n: 'Length', t: R`1\text{ ft}=12\text{ in},\ 1\text{ yd}=3\text{ ft},\ 1\text{ mi}=5280\text{ ft}` }, { n: 'Time', t: R`1\text{ hr}=60\text{ min}=3600\text{ s},\ 1\text{ yr}\approx365\text{ days}` }, { n: 'Area and volume', t: R`1\text{ yd}^2=9\text{ ft}^2,\quad1\text{ yd}^3=27\text{ ft}^3,\quad1\text{ ft}^2=144\text{ in}^2` }],
    example: { p: R`A car gets 32 miles per gallon and gas costs \$3.40 a gallon. What does a 600-mile trip cost in gas?`, s: R`$600\text{ mi}\times\frac{1\text{ gal}}{32\text{ mi}}\times\frac{\$3.40}{1\text{ gal}} = 18.75\text{ gal}\times\$3.40 = \$63.75$. Miles cancel miles, gallons cancel gallons, and dollars are left.` },
    pitfalls: [R`Converting square or cubic units with the plain factor: $1\text{ yd}^2$ is $9\text{ ft}^2$, not $3\text{ ft}^2$.`, R`Using a factor upside down, so the units multiply ($\text{ft}^2/\text{in}$) instead of cancelling.`, R`Treating a month as exactly 4 weeks: a year is 52 weeks, so a month is about $52/12\approx4.33$ weeks.`],
    tip: R`Write the unit on every number in your work and cross units out as they cancel. If what is left is not the unit you want, flip a factor.` },

  { id: 'percent', label: '1.2', title: 'Percentages and relative change', unit: 1,
    ideas: [
      R`<b>Percent</b> means "per hundred": $25\% = \frac{25}{100} = 0.25$. To find $P\%$ of a number, multiply by $P/100$.`,
      R`<b>Absolute change</b> is new value minus reference value. <b>Relative change</b> divides that by the <b>reference</b> (starting) value: $\frac{\text{new}-\text{reference}}{\text{reference}}\times100\%$.`,
      R`"A is $P\%$ <b>more than</b> B" means $A = (1+P/100)\times B$; "A is $P\%$ <b>of</b> B" means $A = (P/100)\times B$. So $150\%$ of B is $50\%$ more than B.`,
      R`<b>Percentage points</b> are for comparing two percentages directly: a rate going from 10% to 12% rises 2 percentage points, which is a 20% relative increase.`,
      R`Turn changes into multipliers: up 6% is $\times1.06$, down 20% is $\times0.80$. Successive changes multiply, so up 10% then down 10% is $1.1\times0.9 = 0.99$: a 1% loss, not zero.`,
      R`A quantity can increase by more than 100% (it more than doubles), but it can decrease by at most 100% (down to zero).`
    ],
    formulas: [{ n: 'Relative change', t: R`\frac{\text{new}-\text{reference}}{\text{reference}}\times100\%` }, { n: 'More than / of', t: R`P\%\text{ more than }B=(1+\tfrac{P}{100})B,\qquad P\%\text{ of }B=\tfrac{P}{100}B` }],
    example: { p: R`Tuition rose from \$8,000 to \$9,200. Find the absolute and the relative change.`, s: R`Absolute change: $\$9{,}200-\$8{,}000 = \$1{,}200$. Relative change: $\frac{1200}{8000} = 0.15 = 15\%$, measured from the old (reference) tuition.` },
    pitfalls: [R`Dividing by the new value instead of the reference value.`, R`Adding successive percentage changes (+10% then −10% is not 0%).`, R`Mixing up percentage points and percent.`],
    tip: R`Ask "percent of what?" every time. The "of" value is your reference and goes in the denominator.` },

  { id: 'bignum', label: '1.3', title: 'Large numbers, scientific notation and estimation', unit: 1,
    ideas: [
      R`<b>Scientific notation</b> writes a number as (a number from 1 to 10) $\times$ (a power of 10): $4{,}500{,}000 = 4.5\times10^6$ and $0.0032 = 3.2\times10^{-3}$.`,
      R`To multiply, multiply the front numbers and <b>add</b> the exponents; to divide, divide them and <b>subtract</b> the exponents: $\frac{6\times10^{12}}{3\times10^{8}} = 2\times10^{4}$.`,
      R`Name the powers: thousand $10^3$, million $10^6$, billion $10^9$, trillion $10^{12}$. A billion is a thousand millions; a trillion is a thousand billions.`,
      R`Give big numbers meaning: <b>per capita</b> (divide by the population), <b>comparisons</b> ("about how many times larger?") and <b>scale models</b> (shrink everything by one factor).`,
      R`<b>Estimate first</b>: round to one or two significant digits, do the arithmetic in your head, and use the estimate to catch calculator slips. Don't report more precision than the data have.`
    ],
    formulas: [{ n: 'Multiplying and dividing', t: R`(a\times10^m)(b\times10^n)=ab\times10^{m+n},\qquad\frac{a\times10^m}{b\times10^n}=\frac ab\times10^{m-n}` }, { n: 'Per capita', t: R`\text{per person}=\frac{\text{total}}{\text{population}}` }],
    example: { p: R`Suppose a national debt is \$36 trillion and the population is 340 million. How much is that per person?`, s: R`$\frac{36\times10^{12}}{3.4\times10^{8}} = \frac{36}{3.4}\times10^{4}\approx10.6\times10^4\approx\$106{,}000$ per person. Estimate check: $\frac{40\text{ trillion}}{400\text{ million}} = 10^5 = \$100{,}000$.` },
    pitfalls: [R`Adding exponents when dividing (subtract them).`, R`Mixing up million ($10^6$) and billion ($10^9$): an error by a factor of 1000.`, R`Typing $10^{12}$ as $10\times12$; use the $\times10^n$ key on the TI-30XS.`],
    tip: R`Guess the size of the answer before you compute. If the calculator disagrees by a factor of 1000, look for a million/billion slip.` },

  /* ---------- Unit 2: linear and exponential relations ---------- */
  { id: 'linear', label: '2.1', title: 'Linear relations and rates of change', unit: 2,
    ideas: [
      R`A <b>linear</b> relation changes by the <b>same amount</b> for each step of the input: it has a constant <b>rate of change</b> (its slope), and its graph is a straight line.`,
      R`Rate of change $=\frac{\text{change in output}}{\text{change in input}}=\frac{\Delta y}{\Delta x}$, with units, like dollars per month or degrees per decade.`,
      R`In $y = mx + b$, $m$ is the rate of change and $b$ is the <b>initial value</b> (the output when the input is 0).`,
      R`From two data points: $m = \frac{y_2-y_1}{x_2-x_1}$, then $b = y_1 - m x_1$.`,
      R`Use the model to predict ($y$ for a given $x$) or to solve for when a value is reached: $x = \frac{y-b}{m}$. Predictions far outside the data are risky.`
    ],
    formulas: [{ n: 'Linear model', t: R`y=mx+b` }, { n: 'Rate of change (slope)', t: R`m=\frac{y_2-y_1}{x_2-x_1}` }],
    example: { p: R`A plan costs \$12 a month plus \$3 per movie rental. Write the monthly cost, find the cost of 7 rentals, and how many rentals \$30 buys.`, s: R`$C = 12 + 3n$. Seven rentals: $12 + 21 = \$33$. With \$30: $n = \frac{30-12}{3} = 6$ rentals.` },
    pitfalls: [R`Putting the change in input on top of the slope fraction.`, R`Dropping the units of the slope, which carry its meaning.`, R`Treating a linear model as true far beyond the data.`],
    tip: R`Say the slope as a sentence with units: "the cost rises \$3 for each rental." If the sentence makes no sense, the slope is upside down.` },

  { id: 'expgrowth', label: '2.2', title: 'Exponential growth and decay', unit: 2,
    ideas: [
      R`<b>Exponential growth</b>: the quantity grows by the same <b>percentage</b> each time period, so the amount added keeps getting bigger. <b>Exponential decay</b> shrinks by the same percentage each period.`,
      R`$Q = Q_0\times(1+r)^t$ for growth and $Q = Q_0\times(1-r)^t$ for decay, with $r$ the rate as a decimal and $t$ the number of periods.`,
      R`The <b>growth factor</b> $1+r$ is the multiplier for one period: 3% growth is $\times1.03$; a 15% loss each year is $\times0.85$.`,
      R`Linear adds the same <b>amount</b> (500 people a year); exponential multiplies by the same <b>factor</b> (5% a year). Exponential growth always overtakes linear growth eventually.`,
      R`Examples: populations, prices with inflation, money earning interest, a car losing value, a drug leaving the body. In the real world, growth slows when it meets limits (a <b>carrying capacity</b>).`
    ],
    formulas: [{ n: 'Exponential growth', t: R`Q=Q_0(1+r)^t` }, { n: 'Exponential decay', t: R`Q=Q_0(1-r)^t` }],
    example: { p: R`A town of 12,000 people grows 4% a year. How many people will it have in 10 years?`, s: R`$Q = 12{,}000\times1.04^{10}\approx12{,}000\times1.4802\approx17{,}763$ people. A linear model adding 4% of 12,000 (480) each year would give only 16,800.` },
    pitfalls: [R`Using $r = 4$ instead of $r = 0.04$.`, R`Computing $(1+r)\times t$ instead of $(1+r)^t$.`, R`Using $1+r$ for decay: a 15% decline is $\times0.85$.`],
    tip: R`On the TI-30XS type the whole thing in one line: 12000 $\times$ 1.04 ^ 10. Close the exponent with the right arrow before you keep typing.` },

  { id: 'doubling', label: '2.3', title: 'Doubling time, half-life and real-world growth', unit: 2,
    ideas: [
      R`The <b>doubling time</b> $T_{\text{double}}$ is how long an exponentially growing quantity takes to double. After time $t$: $Q = Q_0\times2^{t/T_{\text{double}}}$.`,
      R`<b>Rule of 70</b>: $T_{\text{double}}\approx\frac{70}{P}$, where $P$ is the percentage growth rate per period (use 3 for 3%, not 0.03). It works well for rates under about 15%.`,
      R`The <b>half-life</b> is how long a decaying quantity takes to halve: $Q = Q_0\times\left(\frac12\right)^{t/T_{\text{half}}}$, and $T_{\text{half}}\approx\frac{70}{P}$ for a $P\%$ decay rate.`,
      R`Exact versions use logarithms: $T_{\text{double}} = \frac{\log_{10}2}{\log_{10}(1+r)}$ and $T_{\text{half}} = -\frac{\log_{10}2}{\log_{10}(1-r)}$.`,
      R`Each doubling adds more than all the earlier growth put together, which is why steady percentage growth (world population at about 1% a year doubles in about 70 years) becomes huge, and why it cannot go on forever.`
    ],
    formulas: [{ n: 'Doubling', t: R`Q=Q_0\cdot2^{t/T_{\text{double}}},\qquad T_{\text{double}}\approx\frac{70}{P}` }, { n: 'Half-life', t: R`Q=Q_0\left(\tfrac12\right)^{t/T_{\text{half}}}` }, { n: 'Exact doubling time', t: R`T_{\text{double}}=\frac{\log_{10}2}{\log_{10}(1+r)}` }],
    example: { p: R`A drug has a half-life of 6 hours. How much of a 400 mg dose is left after a day?`, s: R`24 hours is $\frac{24}{6} = 4$ half-lives, so $400\times\left(\frac12\right)^4 = 400\times\frac1{16} = 25$ mg.` },
    pitfalls: [R`Using the decimal in the rule of 70: $70/0.03$ gives 2333, not 23.3.`, R`Confusing the number of doublings ($t/T$) with the time $t$.`, R`Using the rule of 70 for very large rates, where it is far off.`],
    tip: R`Count the doublings or halvings first ($t \div T$). Then the answer is the start times $2$ or $\frac12$ to that power.` },

  /* ---------- Unit 3: financial mathematics ---------- */
  { id: 'budget', label: '3.1', title: 'Budgets and the cost of habits', unit: 3,
    ideas: [
      R`A <b>budget</b> compares monthly income with monthly expenses. Put irregular costs on a monthly basis: a \$1,200-a-year insurance bill is \$100 a month.`,
      R`Small, regular costs add up: \$5 a day is about \$1,825 a year. Multiply by days, weeks or months to see the yearly total.`,
      R`Express spending as a <b>percentage of income</b> (rent divided by take-home pay) to compare with guidelines, such as keeping housing near 30% of income.`,
      R`To compare choices (buy or lease, meal plan or groceries), find each option's <b>total cost over the same time period</b>.`,
      R`<b>Gross pay</b> is before taxes and deductions; <b>take-home (net) pay</b> is what you actually get to budget with.`
    ],
    formulas: [{ n: 'Yearly cost', t: R`\text{cost per day}\times365,\quad\text{per week}\times52,\quad\text{per month}\times12` }, { n: 'Share of income', t: R`\frac{\text{expense}}{\text{income}}\times100\%` }],
    example: { p: R`You buy a \$4.50 coffee five days a week. What does that cost over four years of college?`, s: R`$\$4.50\times5\times52\times4 = \$4{,}680$.` },
    pitfalls: [R`Mixing weekly and monthly amounts without converting.`, R`Budgeting from gross pay instead of take-home pay.`],
    tip: R`Convert every amount to the same period (usually monthly) before you add anything.` },

  { id: 'interest', label: '3.2', title: 'Simple and compound interest', unit: 3,
    ideas: [
      R`The <b>principal</b> $P$ is the starting amount; the <b>APR</b> is the annual percentage rate, written as a decimal in formulas; $Y$ is the number of years.`,
      R`<b>Simple interest</b> is paid only on the principal: $A = P(1 + \text{APR}\times Y)$.`,
      R`<b>Compound interest</b> also earns interest on past interest. Once a year: $A = P(1+\text{APR})^Y$. $n$ times a year: $A = P\left(1+\frac{\text{APR}}{n}\right)^{nY}$.`,
      R`The <b>APY</b> (annual percentage yield) is the actual percentage growth in a year: $\left(1+\frac{\text{APR}}{n}\right)^n - 1$. Compare accounts by APY.`,
      R`<b>Continuous compounding</b>: $A = Pe^{\text{APR}\times Y}$, the limit of compounding more and more often. The extra over daily compounding is tiny.`,
      R`<b>Present value</b> runs the formula backwards: to have $A$ in $Y$ years, deposit $P = A\big/\left(1+\frac{\text{APR}}{n}\right)^{nY}$ now.`
    ],
    formulas: [{ n: 'Simple interest', t: R`A=P(1+\text{APR}\times Y)` }, { n: 'Compound interest', t: R`A=P\left(1+\frac{\text{APR}}{n}\right)^{nY}` }, { n: 'APY', t: R`\text{APY}=\left(1+\frac{\text{APR}}{n}\right)^{n}-1` }, { n: 'Continuous', t: R`A=Pe^{\text{APR}\times Y}` }],
    example: { p: R`You deposit \$5,000 at 4% APR compounded monthly. How much is there after 10 years, and what is the APY?`, s: R`$A = 5000\left(1+\frac{0.04}{12}\right)^{120}\approx\$7{,}454.16$. $\text{APY} = \left(1+\frac{0.04}{12}\right)^{12}-1\approx0.04074 = 4.074\%$.` },
    pitfalls: [R`Dividing the APR by $n$ but not multiplying the years by $n$ in the exponent.`, R`Rounding $1+\frac{\text{APR}}{n}$ early: keep every digit until the end.`, R`Using 4 instead of 0.04 for 4%.`],
    tip: R`Type the whole formula in one line with parentheses: 5000(1+0.04/12)^(12×10). It avoids rounding errors.` },

  { id: 'savings', label: '3.3', title: 'Savings plans', unit: 3,
    ideas: [
      R`A <b>savings plan</b> makes equal regular deposits ($PMT$) $n$ times a year into an account earning compound interest.`,
      R`Balance after $Y$ years: $A = PMT\times\frac{\left(1+\frac{\text{APR}}{n}\right)^{nY}-1}{\frac{\text{APR}}{n}}$.`,
      R`Total deposits are $PMT\times n\times Y$; the <b>interest earned</b> is the balance minus the deposits.`,
      R`Time matters most: starting ten years earlier can be worth more than doubling the deposits later.`,
      R`To reach a goal, solve for the deposit: $PMT = A\times\frac{\frac{\text{APR}}{n}}{\left(1+\frac{\text{APR}}{n}\right)^{nY}-1}$.`
    ],
    formulas: [{ n: 'Savings plan', t: R`A=PMT\times\frac{\left(1+\frac{\text{APR}}{n}\right)^{nY}-1}{\frac{\text{APR}}{n}}` }],
    example: { p: R`You save \$100 a month at 6% APR for 30 years. How much will you have, and how much of it is interest?`, s: R`$A = 100\times\frac{(1.005)^{360}-1}{0.005}\approx\$100{,}451.50$. Deposits: $100\times12\times30 = \$36{,}000$, so interest is about \$64,451.50.` },
    pitfalls: [R`Using the compound interest formula for regular deposits.`, R`Forgetting to divide by $\frac{\text{APR}}{n}$ at the end.`],
    tip: R`Compute the bracket $\left(1+\frac{\text{APR}}{n}\right)^{nY}$ first and store it; both the savings and loan formulas use it.` },

  { id: 'loans', label: '3.4', title: 'Loans, credit cards and mortgages', unit: 3,
    ideas: [
      R`An <b>installment loan</b> is paid off with equal regular payments: $PMT = \frac{P\times\frac{\text{APR}}{n}}{1-\left(1+\frac{\text{APR}}{n}\right)^{-nY}}$.`,
      R`Total paid is $PMT\times n\times Y$; total <b>interest</b> is that minus the principal.`,
      R`A longer loan has a <b>lower payment</b> but costs <b>more interest</b> in total. A bigger down payment shrinks the principal.`,
      R`<b>Credit cards</b> charge a high APR on any balance you carry: about $\text{balance}\times\frac{\text{APR}}{12}$ interest each month. Paying only the minimum can take years.`,
      R`<b>Mortgages</b>: fixed rate (the payment never changes) or adjustable rate (it can rise). Compare total cost, not just the monthly payment.`
    ],
    formulas: [{ n: 'Loan payment', t: R`PMT=\frac{P\cdot\frac{\text{APR}}{n}}{1-\left(1+\frac{\text{APR}}{n}\right)^{-nY}}` }, { n: 'Total interest', t: R`PMT\times n\times Y-P` }],
    example: { p: R`A \$20,000 car loan at 6% APR for 5 years, paid monthly. Find the payment and the total interest.`, s: R`$PMT = \frac{20000\times0.005}{1-(1.005)^{-60}}\approx\$386.66$ a month. Total paid $\approx386.656\times60 = \$23{,}199.36$, so interest is about \$3,199.36.` },
    pitfalls: [R`Dropping the minus sign in the exponent $-nY$.`, R`Choosing a loan by its monthly payment alone.`],
    tip: R`Check: the payment times the number of payments must be more than the principal. If not, something is wrong.` },

  /* ---------- Unit 4: probability and statistics ---------- */
  { id: 'studies', label: '4.1', title: 'Statistical studies and the news', unit: 4,
    ideas: [
      R`The <b>population</b> is everyone you want to know about; the <b>sample</b> is who you actually measure. A <b>census</b> measures the whole population. Numbers about a population are <b>parameters</b>; about a sample, <b>statistics</b>.`,
      R`Sampling methods: <b>simple random</b> (every group of people equally likely), <b>systematic</b> (every 10th), <b>stratified</b> (random within groups), <b>cluster</b> (whole randomly chosen groups) and <b>convenience</b> (whoever is easy: often biased). Self-selected online polls are biased too.`,
      R`An <b>observational study</b> only watches; an <b>experiment</b> assigns a treatment. Experiments use a <b>control group</b>, a <b>placebo</b> and <b>blinding</b> (double-blind: neither subjects nor researchers know who got what). Only randomized experiments can show cause and effect.`,
      R`<b>Margin of error</b> for a poll at 95% confidence is about $\frac{1}{\sqrt n}$: about $\pm3\%$ for 1,000 people. The <b>confidence interval</b> is the sample statistic $\pm$ the margin.`,
      R`When you read a study, ask: who paid for it, how the sample was chosen, how questions were worded, whether a <b>confounding</b> variable could explain the result, and whether correlation is being sold as causation.`
    ],
    formulas: [{ n: 'Margin of error (95%)', t: R`\text{margin}\approx\frac{1}{\sqrt n}` }, { n: 'Confidence interval', t: R`\text{statistic}-\text{margin}\ \text{to}\ \text{statistic}+\text{margin}` }],
    example: { p: R`A poll of 1,600 voters finds 52% support a measure. Is a majority clear?`, s: R`Margin $\approx\frac{1}{\sqrt{1600}} = \frac1{40} = 2.5\%$, so the interval is 49.5% to 54.5%. It includes values under 50%, so a majority is not certain.` },
    pitfalls: [R`Trusting a big sample that is biased: size does not fix a bad method.`, R`Concluding cause from an observational study.`],
    tip: R`Find the population, the sample and how it was chosen in the first two sentences of any news story about a study.` },

  { id: 'describe', label: '4.2', title: 'Describing data: center and spread', unit: 4,
    ideas: [
      R`The <b>mean</b> is the sum divided by how many; the <b>median</b> is the middle value of the sorted list (the mean of the two middle ones for an even count); the <b>mode</b> is the most common value.`,
      R`<b>Outliers</b> pull the mean but barely move the median. In a <b>right-skewed</b> distribution (incomes, home prices) the mean is above the median.`,
      R`<b>Range</b> = maximum $-$ minimum. The <b>five-number summary</b> (minimum, lower quartile, median, upper quartile, maximum) is drawn as a <b>boxplot</b>.`,
      R`The <b>standard deviation</b> measures the typical distance from the mean: $s = \sqrt{\frac{\sum(x-\bar x)^2}{n-1}}$. Rough check: $s\approx\frac{\text{range}}{4}$.`,
      R`Two data sets can have the same mean and very different spreads, like wait times at a bank with one line versus several.`
    ],
    formulas: [{ n: 'Mean', t: R`\bar x=\frac{\sum x}{n}` }, { n: 'Standard deviation', t: R`s=\sqrt{\frac{\sum(x-\bar x)^2}{n-1}}` }, { n: 'Range rule of thumb', t: R`s\approx\frac{\text{range}}{4}` }],
    example: { p: R`Find the mean, median, range and standard deviation of 3, 5, 7, 8, 12.`, s: R`Mean $= \frac{35}{5} = 7$; median $= 7$; range $= 12-3 = 9$. Deviations $-4, -2, 0, 1, 5$; squares sum to $46$; $s = \sqrt{46/4} = \sqrt{11.5}\approx3.39$.` },
    pitfalls: [R`Finding the median without sorting first.`, R`Dividing by $n$ instead of $n-1$ for the standard deviation.`],
    tip: R`On the TI-30XS, enter the list with [data] and read the mean, median and $s_x$ from [2nd][stat], 1-Var Stats.` },

  { id: 'normal', label: '4.3', title: 'The normal distribution', unit: 4,
    ideas: [
      R`A <b>normal distribution</b> is symmetric and bell-shaped, with one peak at the mean (which is also the median and the mode). Its spread is set by the standard deviation.`,
      R`<b>68–95–99.7 rule</b>: about 68% of values lie within 1 standard deviation of the mean, 95% within 2, and 99.7% within 3.`,
      R`The <b>standard score</b> $z = \frac{x-\text{mean}}{\text{standard deviation}}$ says how many standard deviations a value is above (positive) or below (negative) the mean.`,
      R`A <b>percentile</b> is the percent of values at or below a value: $z = 0$ is the 50th percentile, $z = 1$ about the 84th, $z = 2$ about the 97.5th, and $z = -1$ about the 16th.`,
      R`Heights, test scores and measurement errors are close to normal; incomes and home prices are skewed, not normal.`
    ],
    formulas: [{ n: 'Standard score', t: R`z=\frac{x-\mu}{\sigma}` }, { n: '68–95–99.7', d: 'Within 1, 2 and 3 standard deviations of the mean: about 68%, 95% and 99.7% of the data.' }],
    example: { p: R`Test scores are normal with mean 500 and standard deviation 100. What percentile is a score of 700?`, s: R`$z = \frac{700-500}{100} = 2$. About 95% are within 2 standard deviations, so 2.5% are above 700: a score of 700 is about the 97.5th percentile.` },
    pitfalls: [R`Subtracting in the wrong order, which flips the sign of $z$.`, R`Forgetting that the 5% outside $\pm2$ standard deviations splits evenly: 2.5% on each side.`],
    tip: R`Sketch the bell with the mean and $\pm1, \pm2, \pm3$ standard deviations marked before every normal question.` },

  { id: 'prob', label: '4.4', title: 'Probability basics', unit: 4,
    ideas: [
      R`A probability is between 0 (impossible) and 1 (certain). <b>Theoretical</b>: for equally likely outcomes, $P(A) = \frac{\text{ways A can happen}}{\text{total outcomes}}$. <b>Empirical</b>: from data, how often it happened.`,
      R`<b>Complement</b>: $P(\text{not }A) = 1 - P(A)$.`,
      R`<b>And</b>: for independent events $P(A\text{ and }B) = P(A)\times P(B)$. For dependent events (like drawing without replacement), use the changed second probability: $P(2\text{ aces}) = \frac4{52}\times\frac3{51}$.`,
      R`<b>Or</b>: if the events cannot both happen, $P(A\text{ or }B) = P(A)+P(B)$; if they overlap, subtract the overlap: $P(A)+P(B)-P(A\text{ and }B)$.`,
      R`<b>At least once</b> in $n$ independent tries: $1-(1-p)^n$. Two dice have 36 equally likely outcomes; a sum of 7 is most likely, at $\frac6{36}$.`
    ],
    formulas: [{ n: 'Theoretical probability', t: R`P(A)=\frac{\text{ways }A\text{ occurs}}{\text{total outcomes}}` }, { n: 'And (independent), or', t: R`P(A\text{ and }B)=P(A)P(B),\quad P(A\text{ or }B)=P(A)+P(B)-P(A\text{ and }B)` }, { n: 'At least once', t: R`1-(1-p)^n` }],
    example: { p: R`What is the probability of rolling at least one 6 in four rolls of a die?`, s: R`$P(\text{no 6 in 4 rolls}) = \left(\frac56\right)^4\approx0.482$, so $P(\text{at least one}) = 1-0.482\approx0.518$.` },
    pitfalls: [R`Adding probabilities of overlapping events without subtracting the overlap (hearts or face cards).`, R`Multiplying for "or" or adding for "and".`],
    tip: R`For "at least one", always go through the complement: 1 minus the chance of none.` },

  { id: 'expected', label: '4.5', title: 'Expected value and the law of large numbers', unit: 4,
    ideas: [
      R`The <b>expected value</b> is the long-run average result per try: multiply each outcome's value by its probability and add.`,
      R`Lotteries, raffles and casino games have a negative expected value for players; insurance has a negative expected value for the buyer and a positive one for the company, which is how both stay in business.`,
      R`The <b>law of large numbers</b>: over many tries, the share of times an event happens gets close to its probability. Individual results stay unpredictable.`,
      R`The <b>gambler's fallacy</b> is believing past independent results change the next one ("red is due"). They don't; streaks are normal.`,
      R`To compare risks, use rates on the same basis, like deaths per 100,000 people or per 100 million miles traveled.`
    ],
    formulas: [{ n: 'Expected value', t: R`EV=\sum(\text{value}\times\text{probability})` }, { n: 'Expected count', t: R`\text{number of tries}\times p` }],
    example: { p: R`A \$5 raffle ticket is one of 1,000 sold for a single \$2,000 prize. What is the expected value of a ticket?`, s: R`Win: $+\$1{,}995$ with probability $0.001$; lose: $-\$5$ with probability $0.999$. $EV = 1995(0.001) - 5(0.999) = 1.995 - 4.995 = -\$3$. On average you lose \$3 per ticket.` },
    pitfalls: [R`Forgetting to subtract the ticket price from the prize.`, R`Expecting the law of large numbers to "balance out" a short streak.`],
    tip: R`List every outcome with its value and probability in a small table; the probabilities must add to 1.` }
];

const FORMULAS = [
  { group: 'Units and percentages', items: [
    { n: 'Conversion factor', d: R`A fraction equal to 1, like $\frac{5280\text{ ft}}{1\text{ mi}}$; multiply so the unwanted unit cancels.` },
    { n: 'Square and cubic units', t: R`1\text{ yd}^2=9\text{ ft}^2,\quad1\text{ yd}^3=27\text{ ft}^3` },
    { n: 'Metric bridges', t: R`1\text{ in}=2.54\text{ cm},\ 1\text{ mi}\approx1.609\text{ km},\ 1\text{ kg}\approx2.205\text{ lb}` },
    { n: 'Relative change', t: R`\frac{\text{new}-\text{reference}}{\text{reference}}\times100\%` },
    { n: 'Percentage points', d: 'The plain difference between two percentages (10% to 12% is 2 percentage points, a 20% relative increase).' }
  ] },
  { group: 'Large numbers', items: [
    { n: 'Powers of ten', t: R`10^3\ \text{thousand},\ 10^6\ \text{million},\ 10^9\ \text{billion},\ 10^{12}\ \text{trillion}` },
    { n: 'Multiply, divide', t: R`10^m\times10^n=10^{m+n},\quad\frac{10^m}{10^n}=10^{m-n}` }
  ] },
  { group: 'Linear and exponential', items: [
    { n: 'Linear', t: R`y=mx+b,\quad m=\frac{y_2-y_1}{x_2-x_1}` },
    { n: 'Exponential', t: R`Q=Q_0(1+r)^t\quad\text{(decay: }1-r)` },
    { n: 'Doubling and half-life', t: R`Q=Q_0\cdot2^{t/T_{\text{double}}},\quad Q=Q_0\left(\tfrac12\right)^{t/T_{\text{half}}}` },
    { n: 'Rule of 70', t: R`T\approx\frac{70}{P}` }
  ] },
  { group: 'Money', items: [
    { n: 'Simple interest', t: R`A=P(1+\text{APR}\times Y)` },
    { n: 'Compound interest', t: R`A=P\left(1+\frac{\text{APR}}{n}\right)^{nY}` },
    { n: 'APY', t: R`\left(1+\frac{\text{APR}}{n}\right)^{n}-1` },
    { n: 'Continuous compounding', t: R`A=Pe^{\text{APR}\times Y}` },
    { n: 'Savings plan', t: R`A=PMT\times\frac{\left(1+\frac{\text{APR}}{n}\right)^{nY}-1}{\frac{\text{APR}}{n}}` },
    { n: 'Loan payment', t: R`PMT=\frac{P\cdot\frac{\text{APR}}{n}}{1-\left(1+\frac{\text{APR}}{n}\right)^{-nY}}` }
  ] },
  { group: 'Statistics', items: [
    { n: 'Mean and standard deviation', t: R`\bar x=\frac{\sum x}{n},\quad s=\sqrt{\frac{\sum(x-\bar x)^2}{n-1}}` },
    { n: 'Standard score', t: R`z=\frac{x-\text{mean}}{\text{standard deviation}}` },
    { n: '68–95–99.7 rule', d: 'About 68%, 95% and 99.7% of a normal distribution lie within 1, 2 and 3 standard deviations of the mean.' },
    { n: 'Margin of error (95%)', t: R`\approx\frac{1}{\sqrt n}` }
  ] },
  { group: 'Probability', items: [
    { n: 'Complement', t: R`P(\text{not }A)=1-P(A)` },
    { n: 'And (independent)', t: R`P(A\text{ and }B)=P(A)\times P(B)` },
    { n: 'Or', t: R`P(A\text{ or }B)=P(A)+P(B)-P(A\text{ and }B)` },
    { n: 'At least once', t: R`1-(1-p)^n` },
    { n: 'Expected value', t: R`\sum\text{value}\times\text{probability}` }
  ] }
];

const fc = [];
const card = (unit, sec, f, b) => fc.push({ id: 'c-' + sec + '-' + (fc.filter(c => c.sec === sec).length + 1), unit, sec, f, b });
card(1, 'units', R`What is a conversion factor?`, R`A fraction equal to 1, like $\frac{12\text{ in}}{1\text{ ft}}$, used so the unwanted unit cancels.`);
card(1, 'units', R`Square feet in a square yard`, R`$9$ (because $3^2 = 9$)`);
card(1, 'units', R`Cubic feet in a cubic yard`, R`$27$ (because $3^3 = 27$)`);
card(1, 'units', R`Square inches in a square foot`, R`$144$`);
card(1, 'units', R`1 inch in centimeters`, R`$2.54$ cm (exactly)`);
card(1, 'units', R`1 mile in kilometers`, R`about $1.609$ km`);
card(1, 'units', R`1 kilogram in pounds`, R`about $2.205$ lb`);
card(1, 'units', R`Feet in a mile; seconds in an hour`, R`$5280$ ft; $3600$ s`);
card(1, 'percent', R`Relative change formula`, R`$\frac{\text{new}-\text{reference}}{\text{reference}}\times100\%$`);
card(1, 'percent', R`From 10% to 12%: change in percentage points, and relative change`, R`Up 2 percentage points; a 20% relative increase.`);
card(1, 'percent', R`Up 10%, then down 10%: net change`, R`$1.1\times0.9 = 0.99$: down 1%.`);
card(1, 'percent', R`"A is 40% more than B" as an equation`, R`$A = 1.40\times B$`);
card(1, 'percent', R`Multiplier for a 25% decrease`, R`$\times0.75$`);
card(1, 'percent', R`Largest possible percentage decrease`, R`100% (down to zero). Increases have no limit.`);
card(1, 'bignum', R`One billion as a power of 10`, R`$10^9$ (a thousand millions)`);
card(1, 'bignum', R`One trillion as a power of 10`, R`$10^{12}$ (a thousand billions)`);
card(1, 'bignum', R`$4{,}500{,}000$ in scientific notation`, R`$4.5\times10^6$`);
card(1, 'bignum', R`$\frac{8\times10^{9}}{2\times10^{3}}$`, R`$4\times10^{6}$ (divide the numbers, subtract the exponents)`);
card(1, 'bignum', R`What does "per capita" mean?`, R`Per person: divide the total by the population.`);
card(1, 'bignum', R`About how many days is a million seconds?`, R`About $11.6$ days (a billion seconds is about 32 years).`);
card(2, 'linear', R`What makes a relation linear?`, R`It changes by the same amount for each unit of input: a constant rate of change.`);
card(2, 'linear', R`In $y = mx + b$, what are $m$ and $b$?`, R`$m$ is the rate of change (slope); $b$ is the initial value (when $x = 0$).`);
card(2, 'linear', R`Slope from two points`, R`$m = \frac{y_2-y_1}{x_2-x_1}$`);
card(2, 'linear', R`When does $y = mx + b$ reach a value $y$?`, R`$x = \frac{y-b}{m}$`);
card(2, 'expgrowth', R`What makes growth exponential?`, R`The same percentage change each period, so the quantity is multiplied by the same factor.`);
card(2, 'expgrowth', R`Exponential growth formula`, R`$Q = Q_0(1+r)^t$`);
card(2, 'expgrowth', R`Growth factor for 3% growth; for a 15% decline`, R`$1.03$; $0.85$`);
card(2, 'expgrowth', R`Linear versus exponential growth`, R`Linear adds the same amount each period; exponential multiplies by the same factor and eventually wins.`);
card(2, 'expgrowth', R`What is a carrying capacity?`, R`The largest population an environment can support; growth slows as it is approached.`);
card(2, 'doubling', R`Rule of 70`, R`Doubling time $\approx\frac{70}{P}$, with $P$ the percentage growth rate (3 for 3%).`);
card(2, 'doubling', R`Amount after time $t$ with doubling time $T$`, R`$Q = Q_0\times2^{t/T}$`);
card(2, 'doubling', R`Amount after time $t$ with half-life $T$`, R`$Q = Q_0\times\left(\frac12\right)^{t/T}$`);
card(2, 'doubling', R`Doubling time at 7% a year (rule of 70)`, R`About 10 years.`);
card(2, 'doubling', R`Exact doubling time`, R`$T = \frac{\log_{10}2}{\log_{10}(1+r)}$`);
card(3, 'budget', R`Yearly cost of \$5 a day`, R`$5\times365 = \$1{,}825$`);
card(3, 'budget', R`Weeks in a month, on average`, R`$52/12\approx4.33$`);
card(3, 'budget', R`Gross pay versus take-home pay`, R`Gross is before taxes and deductions; take-home (net) is what you actually receive.`);
card(3, 'interest', R`Simple interest formula`, R`$A = P(1+\text{APR}\times Y)$`);
card(3, 'interest', R`Compound interest, $n$ times a year`, R`$A = P\left(1+\frac{\text{APR}}{n}\right)^{nY}$`);
card(3, 'interest', R`What is APY?`, R`The actual percentage growth in one year: $\left(1+\frac{\text{APR}}{n}\right)^n-1$. Use it to compare accounts.`);
card(3, 'interest', R`Continuous compounding`, R`$A = Pe^{\text{APR}\times Y}$`);
card(3, 'interest', R`Simple versus compound interest`, R`Simple pays only on the principal; compound also pays on interest already earned.`);
card(3, 'savings', R`Savings plan formula`, R`$A = PMT\times\frac{\left(1+\frac{\text{APR}}{n}\right)^{nY}-1}{\frac{\text{APR}}{n}}$`);
card(3, 'savings', R`Interest earned in a savings plan`, R`Final balance minus total deposits ($PMT\times n\times Y$).`);
card(3, 'savings', R`What matters most for growing savings?`, R`Time: starting early.`);
card(3, 'loans', R`Loan payment formula`, R`$PMT = \frac{P\cdot\frac{\text{APR}}{n}}{1-\left(1+\frac{\text{APR}}{n}\right)^{-nY}}$`);
card(3, 'loans', R`Total interest on a loan`, R`$PMT\times n\times Y - P$`);
card(3, 'loans', R`Longer loan term: payment and total interest?`, R`Lower payment, more total interest.`);
card(3, 'loans', R`Monthly interest on a credit card balance`, R`About balance $\times\frac{\text{APR}}{12}$`);
card(4, 'studies', R`Population versus sample`, R`The population is everyone you want to know about; the sample is the part you measure.`);
card(4, 'studies', R`Observational study versus experiment`, R`An observational study only watches; an experiment assigns a treatment and can show cause.`);
card(4, 'studies', R`What is a placebo?`, R`A fake treatment given to the control group, so expectations affect both groups equally.`);
card(4, 'studies', R`Double-blind`, R`Neither the subjects nor the researchers know who got the real treatment.`);
card(4, 'studies', R`Margin of error for a sample of $n$`, R`About $\frac{1}{\sqrt n}$ (95% confidence).`);
card(4, 'studies', R`What is a confounding variable?`, R`Another factor that could explain the result, such as age in a study of coffee and health.`);
card(4, 'describe', R`Mean versus median with an outlier`, R`The outlier pulls the mean; the median barely moves.`);
card(4, 'describe', R`Right-skewed: mean or median larger?`, R`The mean.`);
card(4, 'describe', R`Five-number summary`, R`Minimum, lower quartile, median, upper quartile, maximum.`);
card(4, 'describe', R`Range rule of thumb`, R`$s\approx\frac{\text{range}}{4}$`);
card(4, 'normal', R`68–95–99.7 rule`, R`About 68%, 95% and 99.7% within 1, 2 and 3 standard deviations of the mean.`);
card(4, 'normal', R`Standard score $z$`, R`$z = \frac{x-\text{mean}}{\text{standard deviation}}$`);
card(4, 'normal', R`Percentile of $z = 1$; of $z = -2$`, R`About the 84th; about the 2.5th.`);
card(4, 'prob', R`Complement rule`, R`$P(\text{not }A) = 1-P(A)$`);
card(4, 'prob', R`Probability of a sum of 7 with two dice`, R`$\frac6{36} = \frac16$`);
card(4, 'prob', R`$P(A\text{ or }B)$ when they overlap`, R`$P(A)+P(B)-P(A\text{ and }B)$`);
card(4, 'prob', R`Probability of at least one success in $n$ tries`, R`$1-(1-p)^n$`);
card(4, 'expected', R`Expected value`, R`The sum of value $\times$ probability over all outcomes: the long-run average per try.`);
card(4, 'expected', R`Law of large numbers`, R`Over many tries, the share of successes gets close to the probability.`);
card(4, 'expected', R`Gambler's fallacy`, R`Believing past independent results change the next one. They don't.`);

const PRACTICE = {
  test1: { title: 'Test 1 practice', subtitle: 'Units, percentages and large numbers. Use your TI-30XS and show the units in every step.', problems: [
    { n: 1, sec: 'units', tags: ['conversion'], q: R`Convert 75 miles per hour to feet per second.`, s: R`$75\times\frac{5280}{3600} = 110$ ft/s.` },
    { n: 2, sec: 'units', tags: ['area'], q: R`Carpet costs \$28 per square yard. What does it cost to carpet a 15 ft by 12 ft room?`, s: R`$15\times12 = 180\text{ ft}^2 = \frac{180}{9} = 20\text{ yd}^2$. Cost: $20\times\$28 = \$560$.` },
    { n: 3, sec: 'percent', tags: ['relative change'], q: R`A town's population fell from 25,000 to 22,500. Find the absolute and relative change.`, s: R`Absolute: $-2{,}500$ people. Relative: $\frac{-2500}{25000} = -10\%$.` },
    { n: 4, sec: 'percent', tags: ['percentage points'], q: R`Unemployment rose from 4% to 5%. Describe the change in percentage points and as a relative change.`, s: R`Up 1 percentage point; relative change $\frac{5-4}{4} = 25\%$.` },
    { n: 5, sec: 'percent', tags: ['discount'], q: R`After a 20% discount, a jacket costs \$64. What was the original price?`, s: R`$0.80\times\text{original} = 64$, so the original was $\frac{64}{0.80} = \$80$.` },
    { n: 6, sec: 'bignum', tags: ['per capita'], q: R`A state of 1.1 million people spends \$2.2 billion on schools. How much is that per person?`, s: R`$\frac{2.2\times10^9}{1.1\times10^6} = 2\times10^3 = \$2{,}000$ per person.` },
    { n: 7, sec: 'bignum', tags: ['scientific notation'], q: R`Compute $(3\times10^{5})(4\times10^{7})$ and write it in scientific notation.`, s: R`$12\times10^{12} = 1.2\times10^{13}$.` }
  ] },
  test2: { title: 'Test 2 practice', subtitle: 'Linear and exponential relations, doubling time and half-life.', problems: [
    { n: 1, sec: 'linear', tags: ['slope'], q: R`A used car was worth \$18,000 in 2022 and \$13,500 in 2025. Assuming a linear decline, find the rate of change and predict its value in 2027.`, s: R`$m = \frac{13500-18000}{2025-2022} = -\$1{,}500$ per year. 2027: $13{,}500 - 2\times1{,}500 = \$10{,}500$.` },
    { n: 2, sec: 'linear', tags: ['model'], q: R`A gym charges a \$50 sign-up fee plus \$25 a month. Write the cost after $m$ months and find when the total reaches \$350.`, s: R`$C = 50 + 25m$. $350 = 50 + 25m$ gives $m = 12$ months.` },
    { n: 3, sec: 'expgrowth', tags: ['growth'], q: R`A city of 80,000 grows 2.5% a year. Find its population in 12 years.`, s: R`$80{,}000\times1.025^{12}\approx107{,}591$.` },
    { n: 4, sec: 'expgrowth', tags: ['decay'], q: R`A \$24,000 car loses 15% of its value each year. What is it worth after 5 years?`, s: R`$24{,}000\times0.85^5\approx\$10{,}649$.` },
    { n: 5, sec: 'doubling', tags: ['rule of 70'], q: R`A population grows 3.5% a year. Estimate its doubling time and how much larger it is after 60 years.`, s: R`$T\approx\frac{70}{3.5} = 20$ years. 60 years is 3 doublings: $2^3 = 8$ times as large.` },
    { n: 6, sec: 'doubling', tags: ['half-life'], q: R`Carbon-14 has a half-life of about 5,730 years. What fraction of the original carbon-14 is left after 17,190 years?`, s: R`$\frac{17190}{5730} = 3$ half-lives: $\left(\frac12\right)^3 = \frac18$.` }
  ] },
  test3: { title: 'Test 3 practice', subtitle: 'Budgets, interest, savings plans and loans. Keep every digit until the end.', problems: [
    { n: 1, sec: 'budget', tags: ['habit'], q: R`You spend \$12 on lunch out every weekday. What does that cost in a year?`, s: R`$12\times5\times52 = \$3{,}120$.` },
    { n: 2, sec: 'interest', tags: ['simple vs compound'], q: R`\$2,000 is invested for 8 years at 5%. Compare simple interest with interest compounded annually.`, s: R`Simple: $2000(1+0.05\times8) = \$2{,}800$. Compound: $2000(1.05)^8\approx\$2{,}954.91$, about \$155 more.` },
    { n: 3, sec: 'interest', tags: ['APY'], q: R`Find the APY of 6% APR compounded monthly.`, s: R`$\left(1+\frac{0.06}{12}\right)^{12}-1 = 1.005^{12}-1\approx0.06168 = 6.168\%$.` },
    { n: 4, sec: 'savings', tags: ['savings plan'], q: R`You deposit \$200 a month at 5% APR for 20 years. Find the balance and the interest earned.`, s: R`$200\times\frac{\left(1+\frac{0.05}{12}\right)^{240}-1}{0.05/12}\approx\$82{,}206.73$. Deposits $\$48{,}000$, so interest $\approx\$34{,}206.73$.` },
    { n: 5, sec: 'loans', tags: ['mortgage'], q: R`Compare the monthly payment on a \$250,000 mortgage at 6.5% for 30 years with 6% for 15 years.`, s: R`30 years: $\frac{250000\times\frac{0.065}{12}}{1-\left(1+\frac{0.065}{12}\right)^{-360}}\approx\$1{,}580.17$. 15 years: $\approx\$2{,}109.64$. The 15-year loan costs about \$529 more a month but far less interest: about \$129,736 versus \$318,861.` },
    { n: 6, sec: 'loans', tags: ['credit card'], q: R`A credit card has a \$3,000 balance at 21% APR. About how much interest is charged for one month?`, s: R`$3000\times\frac{0.21}{12} = \$52.50$.` }
  ] },
  test4: { title: 'Test 4 practice', subtitle: 'Studies, describing data, the normal distribution and probability.', problems: [
    { n: 1, sec: 'studies', tags: ['study design'], q: R`Researchers compare the grades of students who chose to use a tutoring center with those who didn't. Is this an experiment? Can it show the center causes higher grades?`, s: R`No: students chose for themselves, so it is observational. Motivated students may both use the center and earn higher grades (a confounding variable), so it cannot show cause.` },
    { n: 2, sec: 'studies', tags: ['margin of error'], q: R`A poll of 2,500 people finds 46% approve. Find the margin of error and the 95% confidence interval.`, s: R`$\frac{1}{\sqrt{2500}} = 0.02 = 2\%$: from 44% to 48%.` },
    { n: 3, sec: 'describe', tags: ['mean', 'median'], q: R`Five home prices: \$180k, \$210k, \$195k, \$240k, \$1.2 million. Find the mean and median. Which better describes a typical home?`, s: R`Mean $= \frac{2025}{5} = \$405\text{k}$; median $= \$210\text{k}$. The median: the \$1.2 million outlier pulls the mean up.` },
    { n: 4, sec: 'normal', tags: ['z-score'], q: R`Heights of women are normal with mean 64.5 in and standard deviation 2.5 in. What share are taller than 69.5 in?`, s: R`$z = \frac{69.5-64.5}{2.5} = 2$. About 2.5% are taller.` },
    { n: 5, sec: 'prob', tags: ['and', 'or'], q: R`You draw one card from a standard deck. Find P(heart or face card).`, s: R`$\frac{13}{52}+\frac{12}{52}-\frac3{52} = \frac{22}{52}\approx0.423$ (3 face cards are hearts).` },
    { n: 6, sec: 'prob', tags: ['at least one'], q: R`A flight is late 20% of the time. If you take 5 flights, what is the probability at least one is late?`, s: R`$1-0.8^5 = 1-0.32768\approx0.672$.` },
    { n: 7, sec: 'expected', tags: ['expected value'], q: R`A game costs \$2 to play. You win \$10 (a net gain of \$8) with probability 0.15. Find the expected value.`, s: R`$8(0.15) - 2(0.85) = 1.20 - 1.70 = -\$0.50$ per play.` }
  ] },
  final: { title: 'Final exam practice', subtitle: 'A mix of every unit. The final is comprehensive.', problems: [
    { n: 1, sec: 'units', tags: ['rates'], q: R`Water costs \$0.004 per gallon. A shower uses 2.1 gallons per minute. What does a 10-minute shower every day cost in a year?`, s: R`$2.1\times10\times365 = 7{,}665$ gal; $7665\times0.004\approx\$30.66$.` },
    { n: 2, sec: 'percent', tags: ['successive changes'], q: R`A stock rises 25% and then falls 20%. What is the net change?`, s: R`$1.25\times0.80 = 1.00$: no net change.` },
    { n: 3, sec: 'doubling', tags: ['exact doubling'], q: R`Find the exact doubling time for 3% annual growth and compare with the rule of 70.`, s: R`$\frac{\log_{10}2}{\log_{10}1.03}\approx23.45$ years; rule of 70: $\frac{70}{3}\approx23.3$ years.` },
    { n: 4, sec: 'interest', tags: ['present value'], q: R`How much must you deposit now at 5% compounded annually to have \$10,000 in 5 years?`, s: R`$\frac{10000}{1.05^5}\approx\$7{,}835.26$.` },
    { n: 5, sec: 'savings', tags: ['goal'], q: R`You want \$20,000 in 5 years, saving monthly at 4% APR. What monthly deposit do you need?`, s: R`$PMT = 20000\times\frac{0.04/12}{\left(1+\frac{0.04}{12}\right)^{60}-1}\approx\$301.66$.` },
    { n: 6, sec: 'normal', tags: ['percentile'], q: R`IQ scores are normal with mean 100 and standard deviation 15. About what percentile is an IQ of 85?`, s: R`$z = -1$, so about the 16th percentile.` },
    { n: 7, sec: 'expected', tags: ['law of large numbers'], q: R`You flip a fair coin 1,000 times. How many heads do you expect? Does getting 10 heads in a row make tails more likely next?`, s: R`About 500 heads. No: each flip is independent, so tails is still $\frac12$ (the gambler's fallacy).` }
  ] }
};

const CHECKLISTS = {
  test1: ['I can convert units with conversion factors, including square and cubic units and rates.', 'I can find a percent of a number and work backwards from a discounted or taxed price.', 'I can find absolute and relative change and tell percentage points from percent.', 'I can explain why +10% then −10% is a loss.', 'I can write numbers in scientific notation and multiply and divide them.', 'I can put big numbers in perspective with per capita values, comparisons and scale.'],
  test2: ['I can find and interpret a rate of change with units.', 'I can write y = mx + b from a description or two data points, predict with it and solve for x.', 'I can tell linear from exponential growth.', 'I can use Q = Q0(1 + r)^t for growth and decay.', 'I can use the rule of 70, doubling time and half-life.', 'I can explain why steady percentage growth cannot last forever.'],
  test3: ['I can put expenses on a monthly or yearly basis and find a share of income.', 'I can use simple and compound interest, and continuous compounding.', 'I can find and compare APYs.', 'I can find a savings plan balance, the interest earned, and the deposit needed for a goal.', 'I can find a loan payment, the total paid and the total interest.', 'I can compare loan terms and explain credit card interest.'],
  test4: ['I can name the population, sample and sampling method of a study and spot bias.', 'I can tell an observational study from an experiment and explain placebos, blinding and confounding.', 'I can find a margin of error and confidence interval.', 'I can find the mean, median, range and standard deviation, and say which center fits skewed data.', 'I can use z-scores and the 68–95–99.7 rule.', 'I can find probabilities with the complement, and, or and at least once rules.', 'I can compute an expected value and explain the law of large numbers and the gambler’s fallacy.'],
  final: ['I have reviewed every test and the problems I missed.', 'I can use each formula on the formula sheet without looking.', 'I can do a full problem from each unit on my TI-30XS without a phone.', 'I know when and where the common-hour final is.']
};

module.exports = { SECTIONS, FORMULAS, FLASHCARDS: fc, PRACTICE, CHECKLISTS };
