55rd Ukrainian National Mathematical Olympiad - Third Round (Second Tour)

Probelms: Prove that number $m^4 + 1$ has no divisors in interval $[m^2 - 2m, m^2 + 2m]$ for every natural $m > 2$.


Solution: Suppose the opposite. Let
$$
m^2 + a \in [m^2 - 2m, m^2 + 2m] \text{ i } m^4 + 1 \equiv m^2 + a.
$$
Since
$$
(m^4 + 1, m^2 + a) = (-a m^2 + 1, m^2 + a) = (a^2 + 1, m^2 + a), \text{ then } a^2 + 1 \equiv m^2 + a, \\
 a^2 + 1 = (m^2 + a) r.
$$
Let $a \in [-2m+3, 0]$, then $\frac{m^4+1}{m^2+a} \le \frac{m^4+1}{m^2-2m+3} < m^2+2m+1$, so $m^4+1$ has a divisor that is no less than $m^2$ and fulfills the assumption, therefore instead of $m^2+a$ we can examine a divisor $m^2+b$, where $b \ge 0$.
If $a = -2m + 2$, then $4m^2 - 8m + 5 \equiv m^2 - 2m + 2$, so $3 \equiv m^2 - 2m + 2$, which is impossible in case of $m > 1$.
If $a = -2m + 1$, then $4m^2 - 4m + 2 \equiv (m-1)^2 - m - 1$, thus $2 \equiv m - 1$, $m \in \{2,3\}$. In case of $m = 2$ and $m = 3$: $m^4 + 1 = 17$ and $m^4 + 1 = 2 \cdot 41$ - none of these numbers fulfills the condition.
If $a = -2m$, then $1 \equiv m$ is a contradiction.
Thus, if number $m^4 + 1$ has a divisor $m^2 + a$, where $a \in [-2m, 2m]$, then the number $m^4 + 1$ has a divisor $m^2 + b$, where $b \in [0, 2m]$. It is also clear that $b \ne 0$. In such case, $4m^2 + 1 \ge b^2 + 1 = (m^2 + b) r \ge m^2 r$, so $r \le 3$.
Case $r = 3$: $b^2 + 1 = 3(m^2 + b)$ - it is impossible, because $b^2 + 1$ is not divisible by 3.
Case $r = 2$: $b^2 + 1 = 2(m^2 + b)$, $(b-1)^2 = 2m^2$ - impossible.
Case $r=1$: $b^2 - b + 1 = m^2$, but $b^2 > b^2 - b + 1 = m^2 > (b-1)^2$, so this case is also impossible. Thus, we have the contradiction with the supposition, so the statement is proved.