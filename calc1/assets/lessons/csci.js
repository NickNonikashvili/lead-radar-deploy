/* CSCI 127 Joy and Beauty of Data: a lesson for every topic, laid over its notes (app.js, mergeLessons) */
(window.MathubLessons = window.MathubLessons || {}).csci = {
  types: {
    plain: 'Every value in Python has a type, and the type decides what you can do with it. <code>17</code> is an int, <code>3.4</code> a float, <code>"hi"</code> a str and <code>True</code> a bool. The same symbol can mean different things: <code>+</code> adds numbers but glues strings together. <code>/</code> always gives a float; <code>//</code> and <code>%</code> give the whole part and the remainder.',
    figure: { type: 'table', head: ['expression', 'value', 'type'], rows: [['17 // 5', '3', 'int'], ['17 % 5', '2', 'int'], ['17 / 5', '3.4', 'float'], ['"17" + "5"', '"175"', 'str'], ['17 > 5', 'True', 'bool']], caption: 'Same numbers, different operators, different types.' },
    check: [
      ['What is <code>7 // 2</code> and <code>7 % 2</code>?', '3 and 1.'],
      ['What does <code>"3" + 4</code> do?', 'TypeError: you cannot add a str and an int. Use <code>int("3") + 4</code> or <code>"3" + str(4)</code>.'],
      ['What type is <code>10 / 5</code>?', 'float (2.0): <code>/</code> always gives a float.']
    ]
  },
  modules: {
    plain: 'A module is a file of code someone already wrote; <code>import</code> lets you use it. <code>import math</code> then <code>math.sqrt(2)</code>; <code>import random</code> then <code>random.randint(1, 6)</code>. The turtle module draws by moving a pen: <code>forward</code> moves, <code>left</code> and <code>right</code> turn on the spot.',
    figure: { type: 'figure', shapes: [{ kind: 'arrow', from: [0, 0], to: [5, 0], label: 'forward(50)' }, { kind: 'arrow', from: [5, 0], to: [5, 3], label: 'left(90), forward(30)' }, { kind: 'point', at: [0, 0], label: 'start (0, 0)' }, { kind: 'point', at: [5, 3], label: '(50, 30), facing north' }], caption: 'Turns change the heading; only forward and backward move the turtle.' },
    check: [
      ['After <code>from math import sqrt</code>, how do you call it?', '<code>sqrt(16)</code>, without <code>math.</code>.'],
      ['Can <code>random.randint(1, 6)</code> return 6?', 'Yes: both ends are included.'],
      ['A turtle facing east runs <code>right(90)</code>. Which way does it face?', 'South.']
    ]
  },
  functions: {
    plain: 'A function is a named recipe: <code>def</code> writes it down, calling it runs it. Inputs arrive as parameters, and <code>return</code> hands one result back to whoever called. Printing only shows a value on the screen; returning is what lets other code use it. A function with no <code>return</code> gives back <code>None</code>.',
    figure: { type: 'flow', steps: ['quad(3) is called', 'quad calls double(3) → 6', 'quad calls double(6) → 12', 'quad returns 12', '12 + double(1) = 14'], caption: 'Each call runs, returns its value, and the caller carries on.' },
    check: [
      ['What does a function with no <code>return</code> give back?', '<code>None</code>.'],
      ['What is the difference between <code>print(x)</code> and <code>return x</code>?', 'print shows it on screen; return passes it back to the caller to use.'],
      ['Can a variable made inside a function be used outside it?', 'No: it is local to the function.']
    ]
  },
  selection: {
    plain: '<code>if</code> lets a program choose. Python checks the conditions in an <code>if</code>/<code>elif</code>/<code>else</code> chain from the top and runs only the first branch that is true. Two separate <code>if</code> statements are two separate questions, and both can run. Indentation decides what belongs to which branch.',
    figure: { type: 'flow', steps: [{ text: 'score >= 90?', kind: 'decision', note: 'yes: "A"' }, { text: 'score >= 80?', kind: 'decision', note: 'yes: "B"' }, { text: 'else: "C or below"' }], caption: 'In an if/elif chain, the first true condition wins and the rest are skipped.' },
    check: [
      ['For <code>x = 7</code>, what prints: <code>if x > 5: print("big")</code> then <code>if x > 6: print("bigger")</code>?', 'Both "big" and "bigger": they are separate ifs.'],
      ['What is wrong with <code>if x = 5:</code>?', '<code>=</code> assigns; comparing needs <code>==</code>.'],
      ['Which binds tighter, <code>and</code> or <code>or</code>?', '<code>and</code>.']
    ]
  },
  strings: {
    plain: 'A string is a row of characters with numbered seats starting at 0. <code>s[0]</code> is the first, <code>s[-1]</code> the last. A slice <code>s[a:b]</code> copies seats <code>a</code> up to but not including <code>b</code>. Strings cannot be changed in place: methods like <code>upper()</code> hand back a new string.',
    figure: { type: 'table', head: ['p', 'y', 't', 'h', 'o', 'n'], rows: [['0', '1', '2', '3', '4', '5'], ['−6', '−5', '−4', '−3', '−2', '−1']], caption: 's = "python": s[2:5] is "tho", s[-2:] is "on".' },
    check: [
      ['With <code>s = "python"</code>, what is <code>s[1:4]</code>?', '"yth".'],
      ['How do you reverse a string?', '<code>s[::-1]</code>.'],
      ['Does <code>s.upper()</code> change <code>s</code>?', 'No: it returns a new string. Write <code>s = s.upper()</code> to keep it.']
    ]
  },
  iteration: {
    plain: 'Loops repeat work. A <code>for</code> loop runs once per item: each character of a string, each number in a <code>range</code>, each item of a list. A <code>while</code> loop keeps going as long as a condition is true, so something in the body must eventually make it false. The accumulator pattern starts a total before the loop and updates it inside.',
    figure: { type: 'table', head: ['loop', 'i', 'total'], rows: [['before', '–', '0'], ['1st pass', '1', '1'], ['2nd pass', '2', '3'], ['3rd pass', '3', '6'], ['4th pass', '4', '10']], caption: 'total = 0; for i in range(1, 5): total += i. A trace table shows every step.' },
    check: [
      ['What numbers does <code>range(2, 10, 3)</code> give?', '2, 5, 8.'],
      ['Why might a <code>while</code> loop never stop?', 'Nothing in its body ever makes the condition false.'],
      ['Where must <code>total = 0</code> go in the accumulator pattern?', 'Before the loop, not inside it.']
    ]
  },
  recursion: {
    plain: 'A recursive function solves a problem by calling itself on a smaller piece of it. It needs a base case that answers straight away, and a recursive step that moves toward that base case. Trust the smaller call to work, the way you trust a friend to count the rest of a line.',
    figure: { type: 'flow', steps: ['fact(3) = 3 × fact(2)', 'fact(2) = 2 × fact(1)', 'fact(1) = 1 × fact(0)', { text: 'fact(0) = 1: the base case', kind: 'end' }, 'Back up: 1, then 1, then 2, then 6'], caption: 'fact(3) waits on fact(2), which waits on fact(1)… then the answers multiply back up: 6.' },
    check: [
      ['What are the two parts every recursive function needs?', 'A base case and a recursive case that gets closer to it.'],
      ['What happens without a base case?', 'It calls itself forever until Python raises RecursionError.'],
      ['Write <code>fact(0)</code> and <code>fact(n)</code>.', '<code>fact(0) = 1</code>; <code>fact(n) = n * fact(n - 1)</code>.']
    ]
  },
  memory: {
    plain: 'Under the hood, memory is a long row of bytes, and everything is stored as bits. In Python a variable is a name tag pointing at an object, not a box holding it. Two names can point at the same object; <code>is</code> checks for that, while <code>==</code> only checks whether two values look equal.',
    figure: { type: 'table', head: ['place value', '110101', '101101'], rows: [['32', '1', '1'], ['16', '1', '0'], ['8', '0', '1'], ['4', '1', '1'], ['2', '0', '0'], ['1', '1', '1'], ['total', '53', '45']], caption: '110101 = 32 + 16 + 4 + 1 = 53; 45 = 32 + 8 + 4 + 1 = 101101.' },
    check: [
      ['Convert binary 1011 to decimal.', '8 + 2 + 1 = 11.'],
      ['How many bits are in a byte?', '8.'],
      ['What is the difference between <code>a == b</code> and <code>a is b</code>?', '<code>==</code> compares values; <code>is</code> checks if both names point at the same object.']
    ]
  },
  lists: {
    plain: 'A list keeps items in order and, unlike a string, can be changed in place: <code>append</code>, <code>insert</code>, <code>remove</code>, <code>pop</code>, <code>sort</code>. Careful: <code>b = a</code> does not copy the list; it gives the same list a second name, so changing one changes "both". Use <code>a.copy()</code> or <code>a[:]</code> for a real copy.',
    figure: { type: 'figure', shapes: [{ kind: 'text', at: [0, 2], text: 'a' }, { kind: 'text', at: [0, 0], text: 'b' }, { kind: 'arrow', from: [0.4, 2], to: [3, 1.2] }, { kind: 'arrow', from: [0.4, 0], to: [3, 0.8] }, { kind: 'rect', at: [3, 0.4], w: 4, h: 1.2, text: '[1, 3, 5, 8]' }], caption: 'b = a: two names, one list. a is b is True.' },
    check: [
      ['<code>a = [5, 3, 8]; b = a; b.append(1)</code>. What is <code>a</code>?', '<code>[5, 3, 8, 1]</code>: a and b are the same list.'],
      ['What does <code>x = nums.sort()</code> store in <code>x</code>?', '<code>None</code>: sort changes the list in place. Use <code>sorted(nums)</code> for a new list.'],
      ['What does <code>pop()</code> remove?', 'The last item, and it returns it.']
    ]
  },
  files: {
    plain: 'Programs read and save data through files. <code>with open("data.txt") as f:</code> opens a file and closes it for you when the block ends. Reading gives you text, line by line, with a newline at the end of each, so <code>strip()</code> it and convert numbers with <code>int()</code> or <code>float()</code>. Mode <code>"w"</code> wipes the file first; <code>"a"</code> adds to the end.',
    figure: { type: 'flow', steps: ['with open("nums.txt") as f:', 'for line in f:', 'number = int(line.strip())', 'total += number', 'file closes by itself'], caption: 'The standard read loop: open, go line by line, clean, convert, use.' },
    check: [
      ['What does opening a file with <code>"w"</code> do to its old contents?', 'Erases them.'],
      ['Why <code>strip()</code> each line?', 'To remove the newline (and spaces) at the end.'],
      ['Lines 3, 10 and 4 are summed with <code>int(line)</code>. What is the total?', '17.']
    ]
  },
  dicts: {
    plain: 'A dictionary is a lookup table: each key points to a value, like a word to its definition. Look up with <code>d[key]</code>, add or change with <code>d[key] = value</code>. Looking up a missing key crashes with KeyError; <code>d.get(key, default)</code> avoids that. Counting things is the classic use: one key per thing, the count as its value.',
    figure: { type: 'table', head: ['key', 'value'], rows: [['"Ana"', '19'], ['"Ben"', '20'], ['"Cy"', '18']], caption: 'ages["Ben"] is 20; "Ana" in ages checks the keys.' },
    check: [
      ['How do you safely look up a key that might be missing?', '<code>d.get(key, 0)</code> (or any default).'],
      ['Does <code>19 in ages</code> check the values?', 'No: <code>in</code> checks keys. Use <code>19 in ages.values()</code>.'],
      ['Write the counting step for a word <code>w</code>.', '<code>counts[w] = counts.get(w, 0) + 1</code>.']
    ]
  },
  oop: {
    plain: 'A class is a blueprint and an object is one thing built from it. <code>__init__</code> runs when an object is made and sets up its own data with <code>self.name = …</code>. Methods are functions that belong to the class; <code>self</code> is the particular object the method is working on. Two objects from one class keep separate data.',
    figure: { type: 'table', head: ['', 'class Counter', 'a = Counter()', 'b = Counter()'], rows: [['data', 'blueprint: self.n = 0', 'a.n', 'b.n'], ['after a.tick() twice', '', '2', '0']], caption: 'Each object has its own copy of the attributes.' },
    check: [
      ['What does <code>self</code> refer to?', 'The object the method was called on.'],
      ['When does <code>__init__</code> run?', 'Automatically, when you create an object.'],
      ['Two Counters: <code>a.tick()</code> runs twice. What is <code>b.n</code>?', '0: each object keeps its own n.']
    ]
  },
  oop2: {
    plain: 'Inheritance lets a new class start from an existing one: <code>class Dog(Animal):</code> gets everything Animal has, and can add or replace methods. Replacing a method is called overriding; <code>super()</code> calls the parent\'s version so you can build on it instead of copying it.',
    figure: { type: 'tree', root: 'Animal', branches: [{ label: 'Dog', children: [{ label: 'Puppy' }] }, { label: 'Cat' }], caption: 'A Dog is an Animal; a Puppy is a Dog and an Animal.' },
    check: [
      ['<code>class B(A)</code>: does B get A\'s methods?', 'Yes, unless B overrides them.'],
      ['What does <code>super().__init__(name)</code> do?', 'Runs the parent class\'s setup.'],
      ['C inherits B, B overrides <code>hi</code> as <code>"B" + super().hi()</code>, A returns "A". What is <code>C().hi()</code>?', '"BA".']
    ]
  },
  oopprinciples: {
    plain: 'Four ideas make object-oriented code easier to live with. Abstraction: use an object through simple methods without knowing the inside. Encapsulation: keep data and the code that guards it together. Inheritance: share code between related classes. Polymorphism: different objects answer the same method call in their own way.',
    figure: { type: 'table', head: ['principle', 'in one line'], rows: [['abstraction', 'acct.deposit(20), no idea how it is stored'], ['encapsulation', 'change data only through methods'], ['inheritance', 'Truck(Vehicle) reuses Vehicle'], ['polymorphism', 'v.describe() works on any vehicle']], caption: 'The four pillars of OOP.' },
    check: [
      ['A loop calls <code>v.describe()</code> on cars, trucks and bikes. Which principle?', 'Polymorphism.'],
      ['Why change a balance through <code>deposit()</code> instead of setting it directly?', 'Encapsulation: the method can refuse bad values.'],
      ['What must each vehicle class have for that loop to work?', 'A <code>describe()</code> method.']
    ]
  },
  numpy: {
    plain: 'A NumPy array holds a lot of numbers of one type and does math on all of them at once: <code>a * 2</code> doubles every element with no loop. A comparison like <code>a > 4</code> gives an array of True/False, which you can use to pick out elements or count them. That is both shorter and much faster than looping.',
    figure: { type: 'table', head: ['expression', 'result'], rows: [['a', '[2 4 6 8]'], ['a * 10', '[20 40 60 80]'], ['a > 4', '[False False True True]'], ['a[a > 4]', '[6 8]'], ['a.mean()', '5.0']], caption: 'Every operation runs over the whole array.' },
    check: [
      ['With <code>a = np.array([2, 4, 6, 8])</code>, what is <code>(a > 4).sum()</code>?', '2.'],
      ['What does <code>np.linspace(0, 1, 5)</code> give?', '[0. 0.25 0.5 0.75 1.]'],
      ['Why prefer <code>a * 2</code> to a for loop?', 'It is shorter and much faster.']
    ]
  },
  matplotlib: {
    plain: 'matplotlib turns data into pictures. The recipe is always the same: get your x and y data, call a plot function (<code>plot</code>, <code>scatter</code>, <code>bar</code>, <code>hist</code>), add a title, axis labels and a legend, then <code>plt.show()</code>. Pick the plot for the question: lines for change over time, bars to compare groups, histograms for spread.',
    figure: { type: 'graph', x: [1, 12], y: [-10, 32], fns: [{ f: '10-14cos(pi*(x-1)/6)', label: 'Bozeman' }, { f: '20-8cos(pi*(x-1)/6)', label: 'San Diego', dash: true }], xlabel: 'month', ylabel: '°C', caption: 'Two plt.plot calls with label=…, then plt.legend().' },
    check: [
      ['Which plot shows how one value changes over time?', 'A line plot: <code>plt.plot(x, y)</code>.'],
      ['Which plot shows how values are spread out?', 'A histogram: <code>plt.hist(values)</code>.'],
      ['What makes the legend show series names?', 'Passing <code>label="…"</code> to each plot call, then <code>plt.legend()</code>.']
    ]
  },
  pandas: {
    plain: 'pandas works with tables. A DataFrame has named columns, like a spreadsheet; each column is a Series. Load a CSV with <code>pd.read_csv</code>, peek with <code>head()</code>, pick a column with <code>df["score"]</code>, keep rows with a condition like <code>df[df["score"] > 85]</code>, and summarise groups with <code>groupby</code>.',
    figure: { type: 'table', head: ['name', 'major', 'score'], rows: [['Ana', 'CS', '92'], ['Ben', 'Math', '78'], ['Cy', 'CS', '88']], caption: 'df[df["score"] > 85] keeps Ana and Cy; df.groupby("major")["score"].mean() averages per major.' },
    check: [
      ['Average of the score column?', '<code>df["score"].mean()</code>.'],
      ['Rows with score above 85?', '<code>df[df["score"] > 85]</code>.'],
      ['How many students per major?', '<code>df["major"].value_counts()</code>.']
    ]
  },
  compare: {
    plain: 'Python, C and Java solve the same problems with different trade-offs. Python is interpreted and dynamically typed: quick to write, slower to run. C and Java are compiled and statically typed: you declare every type, mistakes are caught before running, and the programs run faster. C makes you manage memory yourself.',
    figure: { type: 'table', head: ['', 'Python', 'Java', 'C'], rows: [['runs as', 'source', 'bytecode', 'machine code'], ['types', 'dynamic', 'static', 'static'], ['speed', 'slower', 'fast', 'fastest'], ['memory', 'automatic', 'automatic', 'by hand']], caption: 'Easier to write versus faster to run.' },
    check: [
      ['Name two advantages of Python over C.', 'Shorter code, no compile step, dynamic typing, huge libraries (any two).'],
      ['What does "statically typed" mean?', 'Every variable has a declared type, checked before the program runs.'],
      ['Which language makes you free memory yourself?', 'C.']
    ]
  }
};
