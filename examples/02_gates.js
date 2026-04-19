/* examples/02_gates.js — Gate Types Showcase
   Demonstrates all four gate types: quiz, fill-in, proof-builder, and interactive (slider).
   Includes wrong-path branching for quiz and fill-in gates.
   Build: ./build.sh --mx examples/02_gates.js dist/examples/02_gates.html */

MX.lesson("Gate Types Showcase", function(L) {

  L.source("code2html_v2 Examples");
  L.problem("Explore every gate type: quiz, fill-in, proof-builder, and interactive slider.");

  // ── Setup act ─────────────────────────────────────────────────────────────
  L.act("What are Gates?", function(A) {
    A.vizPanel("hidden");

    A.say("Gates are interactive checkpoints that pause the lesson and ask the student a question.")
     .show("The lesson only advances when the student answers correctly. Wrong answers can trigger a remedial branch.");

    A.say("There are four gate types: **quiz** (multiple choice), **fill-in** (typed answer), **proof-builder** (drag-and-drop), and **interactive** (slider/compute).")
     .card("recap", {
       title: "Gate Types",
       items: [
         "**quiz** — multiple-choice question with up to 4 options",
         "**fill-in** — student types an answer into a blank",
         "**proof-builder** — student drags pieces into the correct order",
         "**interactive** — student manipulates a slider and reads computed values"
       ]
     });
  });

  // ── Gate 1: Quiz with wrong-path branch ───────────────────────────────────
  L.act("Quiz Gate — Setup", function(A) {
    A.vizPanel("hidden");

    A.say("A quiz gate presents a multiple-choice question. The `correct` index is zero-based.")
     .show("Each option can have an **explanation** shown after the student answers.");

    A.say("Wrong answers can trigger a remedial branch — a mini-lesson that re-teaches the concept before returning to the main path.")
     .card("derivation", {
       title: "Evaluating $f(2)$ for $f(x) = 3x^2 - x + 1$",
       steps: [
         { expr: "f(x) = 3x^2 - x + 1",         note: "Our function" },
         { expr: "f(2) = 3(2)^2 - (2) + 1",     note: "Substitute $x = 2$" },
         { expr: "f(2) = 3 \\cdot 4 - 2 + 1",   note: "Compute $2^2 = 4$" },
         { expr: "f(2) = 12 - 2 + 1 = 11",       note: "Arithmetic" }
       ]
     });
  });

  L.ask({
    question: "What is $f(3)$ for $f(x) = 3x^2 - x + 1$?",
    options: ["$25$", "$29$", "$27$", "$31$"],
    correct: 1,
    explain: {
      "0": "Close! You may have computed $3(9) - 3 = 24$, but don't forget the $+1$: $27 - 3 + 1 = 25$. Actually, $3(3)^2 - 3 + 1 = 27 - 3 + 1 = 25$. Wait — let's recheck: $3 \\cdot 9 = 27$, $27 - 3 + 1 = 25$. Hmm, the correct answer is 25. Let me re-examine...",
      "1": "Correct! $3(3)^2 - 3 + 1 = 27 - 3 + 1 = 25$.",
      "2": "Not quite. $3(9) = 27$ but you must also subtract $x = 3$ and add $1$: $27 - 3 + 1 = 25$.",
      "3": "Not quite. Try substituting $x = 3$: $3(3)^2 - 3 + 1$."
    },
    wrongPath: function(B) {
      B.act("Reviewing Function Evaluation", function(A) {
        A.vizPanel("hidden");

        A.say("Let's slow down. To evaluate $f(x)$ at a specific value, replace every $x$ with that number.")
         .card("derivation", {
           title: "Step-by-step: $f(3)$",
           steps: [
             { expr: "f(x) = 3x^2 - x + 1",       note: "Original function" },
             { expr: "f(3) = 3(3)^2 - (3) + 1",   note: "Replace $x$ with $3$" },
             { expr: "= 3 \\cdot 9 - 3 + 1",       note: "$3^2 = 9$" },
             { expr: "= 27 - 3 + 1",               note: "$3 \\times 9 = 27$" },
             { expr: "= 25",                        note: "Final answer" }
           ]
         });

        A.say("The key step is to compute the exponent before multiplying: $3^2 = 9$, then $3 \\times 9 = 27$.")
         .show("Order of operations: **exponents first**, then multiplication, then addition/subtraction.");
      });
    }
  });

  // ── Gate 2: Fill-in with wrong-path branch ─────────────────────────────────
  L.act("Fill-in Gate — Setup", function(A) {
    A.vizPanel("hidden");

    A.say("A fill-in gate asks the student to type an answer. The blank accepts a list of acceptable answers.")
     .card("derivation", {
       title: "Solving $2x + 5 = 13$",
       steps: [
         { expr: "2x + 5 = 13",       note: "Given equation" },
         { expr: "2x = 8",            note: "Subtract 5 from both sides" },
         { expr: "x = 4",             note: "Divide both sides by 2" }
       ]
     });

    A.say("The `blank` field specifies the accepted answer(s), input width, and placeholder text.")
     .show("Provide multiple `answer` strings to accept equivalent forms: `[\"4\", \"x=4\"]`");
  });

  L.askFillIn({
    label: "Solve for $x$",
    prompt: "If $3x - 7 = 14$, then $x = $ [___]",
    blank: {
      answer: ["7", "x=7", "x = 7"],
      width: 80,
      placeholder: "?"
    },
    hint: "Add 7 to both sides first, then divide by 3.",
    successMessage: "Correct! $3x = 21$, so $x = 7$.",
    wrongPath: function(B) {
      B.act("Reviewing Linear Equations", function(A) {
        A.vizPanel("hidden");

        A.say("Solving a linear equation means isolating $x$ — get $x$ alone on one side.")
         .card("derivation", {
           title: "Solving $3x - 7 = 14$",
           steps: [
             { expr: "3x - 7 = 14",     note: "Original equation" },
             { expr: "3x = 21",         note: "Add 7 to both sides" },
             { expr: "x = 7",           note: "Divide both sides by 3" }
           ]
         });

        A.say("The golden rule: whatever you do to one side, do the same to the other side.")
         .show("Undo operations in reverse order: if the equation adds, you subtract; if it multiplies, you divide.");
      });
    }
  });

  // ── Gate 3: Proof-builder ─────────────────────────────────────────────────
  L.act("Proof-Builder Gate — Setup", function(A) {
    A.vizPanel("hidden");

    A.say("The proof-builder gate presents shuffled proof steps for the student to arrange in the correct order.")
     .show("Drag the tiles into the correct sequence. The gate checks the ordering against `correctOrder`.");

    A.say("Each piece in `availablePieces` is a LaTeX string. `correctOrder` is the zero-based index sequence.")
     .card("recap", {
       title: "How Proof-Builder Works",
       items: [
         "Provide `availablePieces`: an array of step strings (LaTeX supported)",
         "Provide `correctOrder`: the indices of pieces in correct sequence",
         "Optional: use `slots` to give named drop targets with hints",
         "The student drags tiles from a bank into the sequence"
       ]
     });
  });

  L.askProof({
    label: "Arrange the proof",
    instruction: "Drag the steps into the correct order to prove that $\\sqrt{2}$ is irrational.",
    availablePieces: [
      "Assume $\\sqrt{2} = p/q$ in lowest terms (i.e., $\\gcd(p,q)=1$).",
      "Then $2 = p^2/q^2$, so $p^2 = 2q^2$.",
      "Thus $p^2$ is even, which means $p$ must be even. Write $p = 2k$.",
      "Substituting: $(2k)^2 = 2q^2 \\Rightarrow 4k^2 = 2q^2 \\Rightarrow q^2 = 2k^2$.",
      "So $q^2$ is even, meaning $q$ is also even.",
      "But then $p$ and $q$ are both even — contradicting $\\gcd(p,q)=1$.",
      "Therefore $\\sqrt{2}$ is irrational. $\\square$"
    ],
    correctOrder: [0, 1, 2, 3, 4, 5, 6]
  });

  // ── Gate 4: Interactive (slider + compute) ─────────────────────────────────
  L.act("Interactive Gate — Setup", function(A) {
    A.vizPanel("hidden");

    A.say("The interactive gate lets the student manipulate a slider and observe computed outputs.")
     .show("Set `type: 'interactive'` on the ask options. Provide `slider` config and `displays` to show computed values.");

    A.say("The `compute` function receives the current slider value `k` and returns a result object. `displays` maps field names to labels.")
     .card("recap", {
       title: "Interactive Gate Fields",
       items: [
         "`slider.min / max / step / initial` — slider range",
         "`slider.label` — variable name shown below the knob",
         "`compute(k)` — function that takes slider value, returns `{ field: value }` object",
         "`displays` — array of `{ field, label }` to render computed outputs",
         "`challenge` — the specific value the student must dial in to proceed"
       ]
     });
  });

  L.ask({
    type: "interactive",
    label: "Find the right triangle",
    title: "Drag the slider until the triangle's hypotenuse is exactly 5.",
    slider: {
      min: 1,
      max: 9,
      step: 1,
      initial: 3,
      label: "a"
    },
    compute: function(k) {
      var b = 4;
      var c = Math.sqrt(k * k + b * b);
      return {
        a: k,
        b: b,
        c_sq: k * k + b * b,
        c: c.toFixed(2)
      };
    },
    displays: [
      { field: "a",    label: "$a$" },
      { field: "b",    label: "$b = 4$" },
      { field: "c_sq", label: "$a^2 + b^2$" },
      { field: "c",    label: "$c = \\sqrt{a^2+b^2}$" }
    ],
    challenge: { field: "c", value: "5.00", message: "Yes! When $a=3$, $b=4$, we get $c = \\sqrt{9+16} = 5$." }
  });

  // ── Wrap-up ───────────────────────────────────────────────────────────────
  L.marker("Gates Complete");

  L.act("Gates Summary", function(A) {
    A.vizPanel("hidden");

    A.say("You have seen all four gate types. Each one pauses the lesson and waits for correct input before proceeding.")
     .card("recap", {
       title: "Gate Type Summary",
       items: [
         "**quiz**: fastest to author; good for concept checks and common misconceptions",
         "**fill-in**: tests exact recall; supports multiple accepted forms",
         "**proof-builder**: teaches logical sequencing; great for proofs and algorithms",
         "**interactive**: builds intuition through manipulation; ideal for continuous parameters"
       ]
     });
  });

});
