
import html


def simulate_alignment_logic(cost_p, sell_p):
    q_cost = cost_p
    q_sell = sell_p
    
    if sell_p > 0:
        if sell_p > 100:
            q_sell = round(sell_p / 10) * 10
    elif cost_p > 0:
        if cost_p > 100:
            q_cost = round(cost_p / 10) * 10
            
    return q_cost, q_sell

def test_rounding():
    test_cases = [
        # (Cost, Selling, ExpectedCost, ExpectedSelling, Description)
        (0, 159, 0, 160, "ProAudio: >100 should round"),
        (0, 154, 0, 150, "ProAudio: >100 should round down"),
        (0, 50, 0, 50, "ProAudio: <100 should NOT round"),
        (159, 0, 160, 0, "Nology: >100 Cost should round"),
        (0, 242.10, 0, 240, "ProAudio: 242.10 -> 240"),
        (0, 99.99, 0, 99.99, "ProAudio: 99.99 -> 99.99 (No Rounding)"),
    ]
    
    print("Testing Alignment Rounding Logic:")
    for c, s, ec, es, desc in test_cases:
        rc, rs = simulate_alignment_logic(c, s)
        pass_c = rc == ec
        pass_s = rs == es
        status = "PASS" if pass_c and pass_s else "FAIL"
        print(f"  {desc}: C{c}/S{s} -> C{rc}/S{rs} (Exp: C{ec}/S{es}) - {status}")

def test_decoding():
    name = "32-55&#8243; TV Mount"
    decoded = html.unescape(name)
    print(f"\nDecoding Test:\n  '{name}' -> '{decoded}'")

if __name__ == "__main__":
    test_rounding()

