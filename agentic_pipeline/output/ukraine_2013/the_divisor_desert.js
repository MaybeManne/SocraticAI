MX.lesson("The Divisor Desert", function(L) {

L.source("55th Ukrainian National Mathematical Olympiad");
L.meta({ answer: "The interval contains 0 divisors.", estimated_duration_minutes: 10 });

L.problem("Prove that the number m^4 + 1 has no divisors in the interval [m^2 - 2m, m^2 + 2m] for every natural m > 2.", { highlight: "Prove m^4 + 1 has no divisors in [m^2 - 2m, m^2 + 2m]" });

L.viz({ plugin: "gauntlet_viz", config: {} });


L.act("The Needle in the Haystack", function(A) {
  A.vizPanel("svg");

  A.say("Let's consider the number $m^4 + 1$. If $m$ is 10, this evaluates to 10,001. We want to prove that this massive number has absolutely no divisors in a very specific, tiny window: the interval from $m^2 - 2m$ to $m^2 + 2m$.");

  A.say("For $m=10$, that window is the shaded bracket between 80 and 120. Why this specific window? Because $m^2$, which is 100, is roughly the square root of our massive number. We are looking for divisors right near the center.");

  A.say("Watch what happens if we drop the actual prime factorization of 10,001 onto the number line. It factors into 73 times 137. Notice how both of these factors land just outside our shaded bracket. Our job is to prove this zone is always completely empty, no matter what $m$ we choose.");

});


L.act("The Degree Collapse", function(A) {
  A.vizPanel("svg");

  A.say("Testing every single number in this window is impossible. Instead, let's represent any potential divisor in this interval as $m^2 + a$, where $a$ is a small integer between $-2m$ and $2m$. If $m^2 + a$ really does divide $m^4 + 1$, we can use a clever trick.");

  A.say("Let's look at this through the lens of modular arithmetic. In the world modulo $m^2 + a$, the term $m^2$ is simply equivalent to $-a$. Watch what happens to $m^4$. Since it's just $m^2$ squared, it becomes $-a$ squared, or simply $a^2$.");

  A.say("Suddenly, our massive dividend $m^4 + 1$ collapses down to just $a^2 + 1$. The problem transforms from impossible arithmetic into beautifully manageable algebra. We now only need to check if $m^2 + a$ divides $a^2 + 1$.")
   .inline("svg");

});

// WARNING: No gate spec found for gate_1_mod

L.act("The Co-Divisor Fold", function(A) {
  A.vizPanel("svg");

  A.say("Divisors always come in pairs. If there is a divisor on the left side of $m^2$, its partner must be on the right side.");

  A.say("Divisors always come in pairs. If there is a divisor on the left side of $m^2$, its partner must be on the right side.");

});


L.act("The Squeeze", function(A) {
  A.vizPanel("svg");

  A.say("Since we only care about positive values of $a$, we know $m^2 + a$ must divide $a^2 + 1$ perfectly. Let's define their ratio as an integer multiple, $r$.");

  A.say("Let's look at the extremes. The largest $a$ can be in our interval is $2m$. If we plug that in, the numerator becomes $4m^2 + 1$, and the denominator is $m^2 + 2m$.");

  A.say("For any $m$ greater than 2, this ratio is strictly less than 4. And because $r$ must be a whole number, it can only possibly be 1, 2, or 3.");

});

// WARNING: No gate spec found for gate_2_bound

L.act("The Gauntlet", function(A) {
  A.vizPanel("svg");

  A.say("We have exactly three possibilities left. Let's run them through the gauntlet. First, if $r = 3$, our equation says $a^2 + 1$ must be a multiple of three. But think about perfect squares: they are never one less than a multiple of three. The modular arithmetic clock strikes it down.")
   .do("run_gauntlet", {}, "0");

  A.say("What if $r = 2$? A little algebra gives us $(a-1)^2 = 2m^2$. If we take the square root of both sides, we get the square root of two equals a fraction of integers. But the square root of two is famously irrational! The logic shatters.")
   .do("run_gauntlet", {}, "0");

  A.say("Finally, if $r = 1$, the equation simplifies to $m^2 = a^2 - a + 1$. But look at the number line of perfect squares. This value drops exactly into the uncrossable gap between $(a-1)^2$ and $a^2$. It can never be an integer squared.")
   .do("run_gauntlet", {}, "0");

  A.say("All three possibilities fail. The interval we started with is completely empty. For any $m$ greater than two, there are exactly zero divisors hidden here.")
   .do("zoom_number_line", {}, "0")
   .inline("svg");

});

});