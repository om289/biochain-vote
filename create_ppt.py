#!/usr/bin/env python3
"""
Generate a professional Blockchain Guest Lecture PPT (14 slides)
Dark theme, modern design, with generated images.
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import os

# ─── Config ───
BRAIN_DIR = os.path.expanduser("~/.gemini/antigravity/brain/49d0117f-3114-48f4-841c-7321daec08b5")
OUTPUT_PATH = os.path.expanduser("~/biochainnew/Blockchain_Guest_Lecture.pptx")

# Image paths
IMAGES = {
    "chain": os.path.join(BRAIN_DIR, "blockchain_chain_1775235050028.png"),
    "hash": os.path.join(BRAIN_DIR, "hashing_concept_1775235066699.png"),
    "consensus": os.path.join(BRAIN_DIR, "consensus_mechanisms_1775235083463.png"),
    "smart": os.path.join(BRAIN_DIR, "smart_contracts_1775235117919.png"),
    "apps": os.path.join(BRAIN_DIR, "blockchain_applications_1775235131978.png"),
}

# Colors
BG_DARK = RGBColor(0x0B, 0x0E, 0x17)       # Very dark navy
BG_CARD = RGBColor(0x12, 0x16, 0x24)        # Slightly lighter card bg
ACCENT_BLUE = RGBColor(0x00, 0x9E, 0xFF)    # Bright blue
ACCENT_CYAN = RGBColor(0x00, 0xE5, 0xD0)    # Cyan/teal
ACCENT_PURPLE = RGBColor(0x8B, 0x5C, 0xF6)  # Purple
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY = RGBColor(0xB0, 0xB8, 0xC8)
MEDIUM_GRAY = RGBColor(0x7A, 0x84, 0x96)
DARK_OVERLAY = RGBColor(0x0B, 0x0E, 0x17)


def set_slide_bg(slide, color=BG_DARK):
    """Set solid background color for a slide."""
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_shape(slide, left, top, width, height, color, alpha=None):
    """Add a colored rectangle shape."""
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    if alpha is not None:
        shape.fill.fore_color.brightness = alpha
    return shape


def add_rounded_rect(slide, left, top, width, height, color):
    """Add a rounded rectangle."""
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


def add_text_box(slide, left, top, width, height, text, font_size=18, color=WHITE, bold=False, alignment=PP_ALIGN.LEFT, font_name="Calibri"):
    """Add a text box with formatted text."""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.font.name = font_name
    p.alignment = alignment
    return txBox


def add_bullet_text(slide, left, top, width, height, items, font_size=16, color=LIGHT_GRAY, bullet_color=ACCENT_CYAN, font_name="Calibri"):
    """Add bulleted text items."""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.space_after = Pt(8)
        p.space_before = Pt(4)

        # Bullet character
        run_bullet = p.add_run()
        run_bullet.text = "▸ "
        run_bullet.font.size = Pt(font_size)
        run_bullet.font.color.rgb = bullet_color
        run_bullet.font.name = font_name

        # Check if item has bold prefix (format: "**Bold Part:** Rest")
        if ":" in item and item.index(":") < 40:
            parts = item.split(":", 1)
            run_bold = p.add_run()
            run_bold.text = parts[0] + ":"
            run_bold.font.size = Pt(font_size)
            run_bold.font.color.rgb = WHITE
            run_bold.font.bold = True
            run_bold.font.name = font_name

            run_rest = p.add_run()
            run_rest.text = parts[1]
            run_rest.font.size = Pt(font_size)
            run_rest.font.color.rgb = color
            run_rest.font.name = font_name
        else:
            run_text = p.add_run()
            run_text.text = item
            run_text.font.size = Pt(font_size)
            run_text.font.color.rgb = color
            run_text.font.name = font_name
    return txBox


def add_accent_line(slide, left, top, width, color=ACCENT_BLUE):
    """Add a horizontal accent line."""
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, Pt(3))
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


def add_slide_number(slide, number, total=14):
    """Add slide number at bottom right."""
    add_text_box(slide, Inches(8.5), Inches(6.8), Inches(1.2), Inches(0.3),
                 f"{number}/{total}", font_size=10, color=MEDIUM_GRAY, alignment=PP_ALIGN.RIGHT)


def add_topic_header(slide, number, title, subtitle=None):
    """Add a consistent topic header with number badge."""
    # Number badge
    badge = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(0.5), Inches(0.35), Inches(0.55), Inches(0.55))
    badge.fill.solid()
    badge.fill.fore_color.rgb = ACCENT_BLUE
    badge.line.fill.background()
    tf = badge.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.text = str(number)
    p.font.size = Pt(20)
    p.font.color.rgb = WHITE
    p.font.bold = True
    p.font.name = "Calibri"
    p.alignment = PP_ALIGN.CENTER
    tf.paragraphs[0].space_before = Pt(0)
    tf.paragraphs[0].space_after = Pt(0)

    # Title
    add_text_box(slide, Inches(1.25), Inches(0.3), Inches(7), Inches(0.6),
                 title, font_size=28, color=WHITE, bold=True)

    # Accent line
    add_accent_line(slide, Inches(1.25), Inches(0.95), Inches(2))

    # Subtitle
    if subtitle:
        add_text_box(slide, Inches(1.25), Inches(1.0), Inches(8), Inches(0.4),
                     subtitle, font_size=14, color=MEDIUM_GRAY)


# ═══════════════════════════════════════════════════
# CREATE PRESENTATION
# ═══════════════════════════════════════════════════
prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

# ─── SLIDE 1: Title Slide ───
slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank layout
set_slide_bg(slide)

# Background image (right side, faded)
if os.path.exists(IMAGES["chain"]):
    pic = slide.shapes.add_picture(IMAGES["chain"], Inches(6), Inches(0.5), Inches(7), Inches(7))

# Dark overlay on left
add_shape(slide, Inches(0), Inches(0), Inches(7.5), SLIDE_H, BG_DARK)

# Gradient-like fade overlay
fade = add_shape(slide, Inches(6.5), Inches(0), Inches(2), SLIDE_H, BG_DARK)

# Title text
add_text_box(slide, Inches(0.8), Inches(1.8), Inches(6), Inches(0.5),
             "GUEST LECTURE", font_size=16, color=ACCENT_CYAN, bold=True)

add_accent_line(slide, Inches(0.8), Inches(2.45), Inches(1.5), ACCENT_CYAN)

add_text_box(slide, Inches(0.8), Inches(2.7), Inches(6), Inches(1.2),
             "Blockchain Technology", font_size=44, color=WHITE, bold=True)

add_text_box(slide, Inches(0.8), Inches(3.8), Inches(6), Inches(0.6),
             "Foundations, Mechanisms & Future", font_size=22, color=LIGHT_GRAY)

add_accent_line(slide, Inches(0.8), Inches(4.6), Inches(3), ACCENT_BLUE)

add_text_box(slide, Inches(0.8), Inches(5.0), Inches(5), Inches(0.4),
             "Siddharth Koul", font_size=20, color=WHITE, bold=True)

add_text_box(slide, Inches(0.8), Inches(5.5), Inches(5), Inches(0.4),
             "Duration: 1 Hour  |  Interactive Session with Live Demos", font_size=14, color=MEDIUM_GRAY)


# ─── SLIDE 2: Agenda / What We'll Cover ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

add_text_box(slide, Inches(0.8), Inches(0.4), Inches(8), Inches(0.6),
             "What We'll Cover Today", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(1.0), Inches(2.5))

topics_left = [
    ("01", "The Trust Problem", ACCENT_BLUE),
    ("02", "What is Blockchain?", ACCENT_CYAN),
    ("03", "Cryptographic Foundations", ACCENT_PURPLE),
    ("04", "Block Anatomy & Chaining", ACCENT_BLUE),
    ("05", "Consensus Mechanisms", ACCENT_CYAN),
]
topics_right = [
    ("06", "Types of Blockchains", ACCENT_PURPLE),
    ("07", "Smart Contracts", ACCENT_BLUE),
    ("08", "Real-World Applications", ACCENT_CYAN),
    ("09", "Challenges & Limitations", ACCENT_PURPLE),
    ("10", "Future of Blockchain", ACCENT_BLUE),
]

for i, (num, title, color) in enumerate(topics_left):
    y = Inches(1.5) + Inches(i * 1.05)
    card = add_rounded_rect(slide, Inches(0.8), y, Inches(5.5), Inches(0.85), BG_CARD)

    # Number
    badge = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(1.0), y + Inches(0.15), Inches(0.5), Inches(0.5))
    badge.fill.solid()
    badge.fill.fore_color.rgb = color
    badge.line.fill.background()
    tf = badge.text_frame
    p = tf.paragraphs[0]
    p.text = num
    p.font.size = Pt(14)
    p.font.color.rgb = WHITE
    p.font.bold = True
    p.font.name = "Calibri"
    p.alignment = PP_ALIGN.CENTER

    add_text_box(slide, Inches(1.7), y + Inches(0.18), Inches(4), Inches(0.5),
                 title, font_size=18, color=WHITE, bold=True)

for i, (num, title, color) in enumerate(topics_right):
    y = Inches(1.5) + Inches(i * 1.05)
    card = add_rounded_rect(slide, Inches(6.8), y, Inches(5.5), Inches(0.85), BG_CARD)

    badge = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(7.0), y + Inches(0.15), Inches(0.5), Inches(0.5))
    badge.fill.solid()
    badge.fill.fore_color.rgb = color
    badge.line.fill.background()
    tf = badge.text_frame
    p = tf.paragraphs[0]
    p.text = num
    p.font.size = Pt(14)
    p.font.color.rgb = WHITE
    p.font.bold = True
    p.font.name = "Calibri"
    p.alignment = PP_ALIGN.CENTER

    add_text_box(slide, Inches(7.7), y + Inches(0.18), Inches(4), Inches(0.5),
                 title, font_size=18, color=WHITE, bold=True)

add_text_box(slide, Inches(0.8), Inches(7.0), Inches(11), Inches(0.4),
             "🐍  Includes live Python demos  •  🛠️  Open-source tool demonstrations  •  ⛓️  Real testnet deployment",
             font_size=13, color=ACCENT_CYAN, alignment=PP_ALIGN.CENTER)

add_slide_number(slide, 2)


# ─── SLIDE 3: The Trust Problem ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_topic_header(slide, 1, "The Trust Problem in Digital Systems",
                 "Why was blockchain invented in the first place?")

# Left content
add_bullet_text(slide, Inches(0.8), Inches(1.6), Inches(5.8), Inches(4.5), [
    "Single Point of Failure: Centralized systems (banks, servers) can fail, be hacked, or be censored",
    "Double-Spending Problem: How to prevent someone from spending the same digital money twice?",
    "Intermediary Dependence: Every transaction needs a trusted middleman (banks, notaries, clearinghouses)",
    "Byzantine Generals' Problem: How do independent parties agree on truth when some may be dishonest?",
    "Opacity: Users must trust institutions they have no visibility into",
], font_size=15)

# Right - visual analogy card
card = add_rounded_rect(slide, Inches(7.2), Inches(1.6), Inches(5.3), Inches(2.5), BG_CARD)
add_text_box(slide, Inches(7.5), Inches(1.8), Inches(4.8), Inches(0.4),
             "💡  Think of it this way...", font_size=16, color=ACCENT_CYAN, bold=True)
add_text_box(slide, Inches(7.5), Inches(2.3), Inches(4.8), Inches(1.6),
             '"Imagine 10 friends splitting a dinner bill, but nobody trusts anyone to keep the correct tally.\n\nBlockchain = a shared notebook that everyone can read, but nobody can erase."',
             font_size=14, color=LIGHT_GRAY)

# Bottom comparison
card_l = add_rounded_rect(slide, Inches(7.2), Inches(4.5), Inches(2.5), Inches(2.2), RGBColor(0x2D, 0x15, 0x15))
add_text_box(slide, Inches(7.4), Inches(4.7), Inches(2.2), Inches(0.3),
             "❌  Centralized", font_size=14, color=RGBColor(0xFF, 0x6B, 0x6B), bold=True)
add_text_box(slide, Inches(7.4), Inches(5.1), Inches(2.2), Inches(1.4),
             "• Single authority\n• Single point of failure\n• Must trust middleman\n• Censorship possible",
             font_size=12, color=LIGHT_GRAY)

card_r = add_rounded_rect(slide, Inches(10.0), Inches(4.5), Inches(2.5), Inches(2.2), RGBColor(0x0D, 0x2D, 0x1A))
add_text_box(slide, Inches(10.2), Inches(4.7), Inches(2.2), Inches(0.3),
             "✅  Decentralized", font_size=14, color=ACCENT_CYAN, bold=True)
add_text_box(slide, Inches(10.2), Inches(5.1), Inches(2.2), Inches(1.4),
             "• Distributed authority\n• No single failure point\n• Trustless by design\n• Censorship resistant",
             font_size=12, color=LIGHT_GRAY)

add_slide_number(slide, 3)


# ─── SLIDE 4: What is Blockchain? ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_topic_header(slide, 2, "What is Blockchain?",
                 "A distributed, append-only ledger maintained across a peer-to-peer network")

if os.path.exists(IMAGES["chain"]):
    slide.shapes.add_picture(IMAGES["chain"], Inches(6.8), Inches(1.2), Inches(6), Inches(4.5))

# Key properties cards
properties = [
    ("🔗", "Distributed Ledger", "Every node holds a full copy — no single owner"),
    ("🔒", "Immutable", "Once added, blocks cannot be altered without detection"),
    ("👁️", "Transparent", "All transactions visible to participants"),
    ("🌐", "Decentralized", "No single entity controls the network"),
]

for i, (icon, title, desc) in enumerate(properties):
    y = Inches(1.5) + Inches(i * 1.35)
    card = add_rounded_rect(slide, Inches(0.8), y, Inches(5.5), Inches(1.15), BG_CARD)

    add_text_box(slide, Inches(1.0), y + Inches(0.1), Inches(0.5), Inches(0.5),
                 icon, font_size=22, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(1.6), y + Inches(0.1), Inches(4.2), Inches(0.35),
                 title, font_size=17, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, Inches(1.6), y + Inches(0.55), Inches(4.2), Inches(0.5),
                 desc, font_size=13, color=LIGHT_GRAY)

add_slide_number(slide, 4)


# ─── SLIDE 5: Cryptographic Foundations ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_topic_header(slide, 3, "Cryptographic Foundations",
                 "The math that makes blockchain trustless")

if os.path.exists(IMAGES["hash"]):
    slide.shapes.add_picture(IMAGES["hash"], Inches(7.3), Inches(1.2), Inches(5.5), Inches(5.5))

crypto_items = [
    ("🔐", "SHA-256 Hash Functions", 
     "Any input → fixed 256-bit output\nDeterministic, one-way, collision resistant\nAvalanche effect: tiny change → completely different hash"),
    ("🔑", "Public-Key Cryptography",
     "Key pair: Private key (secret) + Public key (shared)\nPrivate key signs transactions\nPublic key verifies — no passwords needed"),
    ("🌳", "Merkle Trees",
     "Hierarchical hash tree structure\nEfficient verification without downloading entire block\nUsed by light clients / SPV nodes"),
]

for i, (icon, title, desc) in enumerate(crypto_items):
    y = Inches(1.5) + Inches(i * 1.8)
    card = add_rounded_rect(slide, Inches(0.8), y, Inches(6.0), Inches(1.55), BG_CARD)

    add_text_box(slide, Inches(1.0), y + Inches(0.1), Inches(0.5), Inches(0.4),
                 icon, font_size=24, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(1.6), y + Inches(0.1), Inches(4.8), Inches(0.35),
                 title, font_size=17, color=ACCENT_BLUE, bold=True)
    add_text_box(slide, Inches(1.6), y + Inches(0.5), Inches(4.8), Inches(1.0),
                 desc, font_size=12, color=LIGHT_GRAY)

# Demo callout
demo = add_rounded_rect(slide, Inches(0.8), Inches(6.5), Inches(6.0), Inches(0.6), RGBColor(0x1A, 0x25, 0x3A))
add_text_box(slide, Inches(1.0), Inches(6.55), Inches(5.5), Inches(0.4),
             "🐍  LIVE DEMO:  Python hashlib — SHA-256 hashing & avalanche effect",
             font_size=13, color=ACCENT_CYAN, bold=True)

add_slide_number(slide, 5)


# ─── SLIDE 6: Block Anatomy & Chaining ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_topic_header(slide, 4, "Anatomy of a Block & Chaining",
                 "How blocks are linked to form an immutable chain")

# Block anatomy table
fields = [
    ("Block Number", "Sequential index (0, 1, 2, ...)"),
    ("Timestamp", "When the block was created"),
    ("Transactions", "List of validated transactions"),
    ("Prev Block Hash", "Hash of the previous block — the \"chain\""),
    ("Nonce", "Number used in mining (PoW)"),
    ("Current Hash", "Hash of all fields combined"),
]

# Table header
header = add_rounded_rect(slide, Inches(0.8), Inches(1.5), Inches(5.5), Inches(0.5), ACCENT_BLUE)
add_text_box(slide, Inches(1.0), Inches(1.53), Inches(2), Inches(0.4),
             "Field", font_size=14, color=WHITE, bold=True)
add_text_box(slide, Inches(3.0), Inches(1.53), Inches(3), Inches(0.4),
             "Description", font_size=14, color=WHITE, bold=True)

for i, (field, desc) in enumerate(fields):
    y = Inches(2.05) + Inches(i * 0.55)
    bg_color = BG_CARD if i % 2 == 0 else RGBColor(0x18, 0x1D, 0x2E)
    row = add_rounded_rect(slide, Inches(0.8), y, Inches(5.5), Inches(0.5), bg_color)

    add_text_box(slide, Inches(1.0), y + Inches(0.05), Inches(1.8), Inches(0.4),
                 field, font_size=13, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, Inches(3.0), y + Inches(0.05), Inches(3.2), Inches(0.4),
                 desc, font_size=13, color=LIGHT_GRAY)

# Key insights
card = add_rounded_rect(slide, Inches(7.0), Inches(1.5), Inches(5.5), Inches(3.5), BG_CARD)
add_text_box(slide, Inches(7.3), Inches(1.7), Inches(5), Inches(0.4),
             "⛓️  Key Insights", font_size=18, color=WHITE, bold=True)
add_bullet_text(slide, Inches(7.3), Inches(2.3), Inches(4.8), Inches(2.5), [
    "Genesis Block (Block #0) has no previous hash — it's hardcoded",
    "Changing Block #3 changes its hash → breaks link to #4 → breaks #5... cascading failure!",
    "This is why blockchain is append-only — you can only add, never edit or delete",
    "Tamper detection is instant and automatic",
], font_size=14)

# Demo callout
demo = add_rounded_rect(slide, Inches(7.0), Inches(5.5), Inches(5.5), Inches(0.6), RGBColor(0x1A, 0x25, 0x3A))
add_text_box(slide, Inches(7.2), Inches(5.55), Inches(5), Inches(0.4),
             "🐍  LIVE DEMO:  Build a blockchain from scratch in Python (~50 lines)",
             font_size=13, color=ACCENT_CYAN, bold=True)

add_slide_number(slide, 6)


# ─── SLIDE 7: Consensus Mechanisms ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_topic_header(slide, 5, "Consensus Mechanisms",
                 "How thousands of strangers agree on truth without a central authority")

if os.path.exists(IMAGES["consensus"]):
    slide.shapes.add_picture(IMAGES["consensus"], Inches(7.0), Inches(1.3), Inches(6), Inches(6))

# PoW card
pow_card = add_rounded_rect(slide, Inches(0.8), Inches(1.5), Inches(5.8), Inches(2.0), BG_CARD)
add_text_box(slide, Inches(1.0), Inches(1.6), Inches(5.4), Inches(0.35),
             "⛏️  Proof of Work (PoW) — Bitcoin", font_size=16, color=ACCENT_BLUE, bold=True)
add_text_box(slide, Inches(1.0), Inches(2.0), Inches(5.4), Inches(1.3),
             "• Miners compete to solve computational puzzles\n• First to solve broadcasts the block; others verify\n• Requires >50% computing power to attack (51% attack)\n• ⚠️ Enormous energy consumption",
             font_size=13, color=LIGHT_GRAY)

# PoS card
pos_card = add_rounded_rect(slide, Inches(0.8), Inches(3.7), Inches(5.8), Inches(2.0), BG_CARD)
add_text_box(slide, Inches(1.0), Inches(3.8), Inches(5.4), Inches(0.35),
             "🪙  Proof of Stake (PoS) — Ethereum", font_size=16, color=ACCENT_CYAN, bold=True)
add_text_box(slide, Inches(1.0), Inches(4.2), Inches(5.4), Inches(1.3),
             "• Validators lock up cryptocurrency as collateral\n• Chosen based on stake size + randomization\n• Dishonest behavior → funds are slashed (destroyed)\n• ✅ ~99.95% less energy than PoW",
             font_size=13, color=LIGHT_GRAY)

# Others
others = add_rounded_rect(slide, Inches(0.8), Inches(5.9), Inches(5.8), Inches(1.2), RGBColor(0x1A, 0x1A, 0x2E))
add_text_box(slide, Inches(1.0), Inches(6.0), Inches(5.4), Inches(0.3),
             "Other Mechanisms:", font_size=14, color=ACCENT_PURPLE, bold=True)
add_text_box(slide, Inches(1.0), Inches(6.35), Inches(5.4), Inches(0.6),
             "DPoS (EOS)  •  Proof of Authority (Private chains)  •  PBFT (Hyperledger Fabric)", 
             font_size=12, color=MEDIUM_GRAY)

add_slide_number(slide, 7)


# ─── SLIDE 8: Types of Blockchains ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_topic_header(slide, 6, "Types of Blockchains",
                 "Not all blockchains are created equal")

types_data = [
    ("Public", "Anyone can join & validate", "Bitcoin, Ethereum", "Max decentralization", ACCENT_BLUE),
    ("Private", "Invited only, designated nodes", "Hyperledger Fabric", "Max throughput & privacy", ACCENT_CYAN),
    ("Consortium", "Group of organizations", "R3 Corda, Quorum", "Cross-org collaboration", ACCENT_PURPLE),
    ("Hybrid", "Mixed access model", "Dragonchain", "Selective transparency", RGBColor(0xFF, 0xA5, 0x00)),
]

# Header row
add_text_box(slide, Inches(1.2), Inches(1.6), Inches(2), Inches(0.4), "Type", font_size=14, color=MEDIUM_GRAY, bold=True)
add_text_box(slide, Inches(3.5), Inches(1.6), Inches(2.8), Inches(0.4), "Access Model", font_size=14, color=MEDIUM_GRAY, bold=True)
add_text_box(slide, Inches(6.5), Inches(1.6), Inches(2.5), Inches(0.4), "Examples", font_size=14, color=MEDIUM_GRAY, bold=True)
add_text_box(slide, Inches(9.3), Inches(1.6), Inches(3), Inches(0.4), "Strength", font_size=14, color=MEDIUM_GRAY, bold=True)

for i, (type_name, access, examples, strength, color) in enumerate(types_data):
    y = Inches(2.2) + Inches(i * 1.0)
    bg = BG_CARD if i % 2 == 0 else RGBColor(0x18, 0x1D, 0x2E)
    add_rounded_rect(slide, Inches(0.8), y, Inches(11.5), Inches(0.85), bg)

    # Type badge
    badge = add_rounded_rect(slide, Inches(1.0), y + Inches(0.15), Inches(2.0), Inches(0.5), color)
    add_text_box(slide, Inches(1.0), y + Inches(0.18), Inches(2.0), Inches(0.4),
                 type_name, font_size=16, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)

    add_text_box(slide, Inches(3.5), y + Inches(0.2), Inches(2.8), Inches(0.5),
                 access, font_size=14, color=LIGHT_GRAY)
    add_text_box(slide, Inches(6.5), y + Inches(0.2), Inches(2.5), Inches(0.5),
                 examples, font_size=14, color=WHITE)
    add_text_box(slide, Inches(9.3), y + Inches(0.2), Inches(3), Inches(0.5),
                 strength, font_size=14, color=color)

# Blockchain Trilemma
trilemma = add_rounded_rect(slide, Inches(2.5), Inches(6.3), Inches(8), Inches(0.9), RGBColor(0x1A, 0x25, 0x3A))
add_text_box(slide, Inches(2.7), Inches(6.35), Inches(7.5), Inches(0.35),
             "⚖️  The Blockchain Trilemma (Vitalik Buterin)", font_size=16, color=WHITE, bold=True)
add_text_box(slide, Inches(2.7), Inches(6.75), Inches(7.5), Inches(0.35),
             "You can optimize for at most 2 of 3:  Decentralization  •  Security  •  Scalability",
             font_size=13, color=ACCENT_CYAN)

add_slide_number(slide, 8)


# ─── SLIDE 9: Smart Contracts ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_topic_header(slide, 7, "Smart Contracts",
                 "Self-executing code that lives on the blockchain")

if os.path.exists(IMAGES["smart"]):
    slide.shapes.add_picture(IMAGES["smart"], Inches(7.3), Inches(1.2), Inches(5.5), Inches(5.2))

add_bullet_text(slide, Inches(0.8), Inches(1.5), Inches(6), Inches(2), [
    "Coined by Nick Szabo (1994), realized by Ethereum (2015)",
    "Written in Solidity (Ethereum), Rust (Solana), Go (Hyperledger)",
    "Once deployed, code is immutable — cannot be changed",
    "Runs on EVM (Ethereum Virtual Machine) — a decentralized world computer",
    "Gas fees: every computation costs gas to prevent spam",
], font_size=14)

# Code example
code_card = add_rounded_rect(slide, Inches(0.8), Inches(3.8), Inches(6), Inches(2.0), RGBColor(0x1E, 0x1E, 0x2E))
add_text_box(slide, Inches(1.0), Inches(3.85), Inches(5.5), Inches(0.3),
             "📝  Simple Example (Pseudo-code)", font_size=13, color=ACCENT_CYAN, bold=True)
add_text_box(slide, Inches(1.0), Inches(4.2), Inches(5.5), Inches(1.5),
             "Contract: Escrow\n  → Buyer deposits funds\n  → If Seller delivers (confirmed by oracle):\n       Release funds to Seller\n  → If 30 days pass, no delivery:\n       Refund to Buyer",
             font_size=12, color=RGBColor(0xA0, 0xE8, 0xA0))

# Applications
apps_card = add_rounded_rect(slide, Inches(0.8), Inches(6.0), Inches(6), Inches(1.2), BG_CARD)
add_text_box(slide, Inches(1.0), Inches(6.1), Inches(5.5), Inches(0.3),
             "Powered by Smart Contracts:", font_size=14, color=WHITE, bold=True)
add_text_box(slide, Inches(1.0), Inches(6.5), Inches(5.5), Inches(0.5),
             "💰 DeFi (Aave, Uniswap)   •   🎨 NFTs (ERC-721)   •   🏛️ DAOs",
             font_size=14, color=ACCENT_CYAN)

add_slide_number(slide, 9)


# ─── SLIDE 10: Real-World Applications ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_topic_header(slide, 8, "Real-World Applications",
                 "Blockchain beyond cryptocurrency")

if os.path.exists(IMAGES["apps"]):
    slide.shapes.add_picture(IMAGES["apps"], Inches(7.0), Inches(1.0), Inches(6), Inches(6))

apps = [
    ("🏥", "Healthcare", "Patient-controlled medical records, tamper-proof audit trails"),
    ("📦", "Supply Chain", "Farm-to-shelf tracking — Walmart uses Hyperledger for food safety"),
    ("🏦", "Finance", "Near-instant cross-border payments vs 3-5 day SWIFT transfers"),
    ("🪪", "Digital Identity", "Self-sovereign identity — users control their own credentials"),
    ("⚡", "Energy", "Peer-to-peer solar energy trading between neighbors"),
    ("🏠", "Real Estate", "Tamper-proof property deeds, reduced fraud & paperwork"),
]

for i, (icon, title, desc) in enumerate(apps):
    y = Inches(1.5) + Inches(i * 0.9)
    card = add_rounded_rect(slide, Inches(0.8), y, Inches(5.8), Inches(0.75), BG_CARD)

    add_text_box(slide, Inches(1.0), y + Inches(0.05), Inches(0.5), Inches(0.4),
                 icon, font_size=20, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(1.5), y + Inches(0.03), Inches(2), Inches(0.3),
                 title, font_size=15, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, Inches(1.5), y + Inches(0.38), Inches(4.8), Inches(0.35),
                 desc, font_size=11, color=LIGHT_GRAY)

add_slide_number(slide, 10)


# ─── SLIDE 11: Challenges & Limitations ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_topic_header(slide, 9, "Challenges & Limitations",
                 "Blockchain is not a silver bullet")

challenges = [
    ("⚡", "Scalability", "Bitcoin: ~7 tx/sec | Ethereum: ~30 tx/sec | Visa: ~65,000 tx/sec\nLayer 2 solutions (Rollups, Lightning Network) aim to solve this", RGBColor(0xFF, 0x6B, 0x6B)),
    ("🔋", "Energy", "PoW is energy-intensive. PoS helps (~99.95% reduction)\nbut public perception still lags behind reality", RGBColor(0xFF, 0xA5, 0x00)),
    ("⚖️", "Regulation", "From full bans (China) to full embrace (El Salvador)\nSmart contracts exist in a legal gray area", RGBColor(0xFF, 0xD7, 0x00)),
    ("🔄", "Irreversibility", "Immutability is a feature AND a bug\nWrong address? No undo. Buggy contract? Funds locked forever", RGBColor(0xFF, 0x6B, 0x6B)),
    ("🔗", "Oracle Problem", "Blockchains can't access external data natively\nOracles (Chainlink) bridge the gap but add trust dependency", RGBColor(0xFF, 0xA5, 0x00)),
]

for i, (icon, title, desc, color) in enumerate(challenges):
    y = Inches(1.5) + Inches(i * 1.1)
    card = add_rounded_rect(slide, Inches(0.8), y, Inches(11.5), Inches(0.95), BG_CARD)

    # Color accent bar on left
    accent = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), y, Inches(0.06), Inches(0.95))
    accent.fill.solid()
    accent.fill.fore_color.rgb = color
    accent.line.fill.background()

    add_text_box(slide, Inches(1.1), y + Inches(0.05), Inches(0.5), Inches(0.35),
                 icon, font_size=20, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(1.7), y + Inches(0.05), Inches(2.5), Inches(0.35),
                 title, font_size=17, color=color, bold=True)
    add_text_box(slide, Inches(4.5), y + Inches(0.05), Inches(7.5), Inches(0.85),
                 desc, font_size=12, color=LIGHT_GRAY)

add_slide_number(slide, 11)


# ─── SLIDE 12: Future of Blockchain ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_topic_header(slide, 10, "The Future of Blockchain",
                 "Where is the technology heading?")

future_items = [
    ("🔐", "Zero-Knowledge Proofs", "Prove something is true WITHOUT revealing the data\nHuge privacy implications (zk-SNARKs, zk-STARKs)", ACCENT_PURPLE),
    ("📈", "Layer 2 & Sharding", "Making blockchains faster without sacrificing decentralization\nEthereum's roadmap: danksharding for massive throughput", ACCENT_BLUE),
    ("🌉", "Interoperability", "Protocols enabling different blockchains to communicate\nPolkadot, Cosmos — the internet of blockchains", ACCENT_CYAN),
    ("🏛️", "CBDCs", "Governments building blockchain-based national currencies\nIndia's Digital Rupee pilot, China's e-CNY", RGBColor(0xFF, 0xA5, 0x00)),
    ("🏗️", "Real-World Asset Tokenization", "Stocks, bonds, real estate as on-chain tokens\nBringing trillions of dollars in assets to blockchain", RGBColor(0x4E, 0xCF, 0x78)),
]

for i, (icon, title, desc, color) in enumerate(future_items):
    col = i % 3
    row = i // 3
    x = Inches(0.8) + Inches(col * 4.1)
    y = Inches(1.5) + Inches(row * 2.8)
    w = Inches(3.8)
    h = Inches(2.5)

    card = add_rounded_rect(slide, x, y, w, h, BG_CARD)

    add_text_box(slide, x + Inches(0.2), y + Inches(0.15), Inches(0.5), Inches(0.4),
                 icon, font_size=26, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, x + Inches(0.8), y + Inches(0.15), Inches(2.8), Inches(0.4),
                 title, font_size=16, color=color, bold=True)
    add_text_box(slide, x + Inches(0.2), y + Inches(0.75), Inches(3.4), Inches(1.5),
                 desc, font_size=12, color=LIGHT_GRAY)

# Closing thought
quote = add_rounded_rect(slide, Inches(1.5), Inches(6.5), Inches(10), Inches(0.7), RGBColor(0x1A, 0x25, 0x3A))
add_text_box(slide, Inches(1.7), Inches(6.55), Inches(9.5), Inches(0.55),
             '"The internet digitized information. Blockchain digitizes trust."',
             font_size=16, color=ACCENT_CYAN, bold=True, alignment=PP_ALIGN.CENTER)

add_slide_number(slide, 12)


# ─── SLIDE 13: Live Demo & Tools ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

add_text_box(slide, Inches(0.8), Inches(0.4), Inches(8), Inches(0.6),
             "🛠️  Live Demos & Open-Source Tools", font_size=32, color=WHITE, bold=True)
add_accent_line(slide, Inches(0.8), Inches(1.0), Inches(2.5))

tools = [
    ("🐍", "Python hashlib", "SHA-256 hashing & avalanche effect demo", "Standard Library"),
    ("⛓️", "Blockchain in Python", "Build a blockchain from scratch (~50 lines)", "Live Code"),
    ("🦊", "MetaMask", "Browser wallet for signing transactions", "Browser Extension"),
    ("💻", "Remix IDE", "Write, compile & deploy Solidity contracts", "remix.ethereum.org"),
    ("🌐", "Sepolia Testnet", "Real Ethereum test network deployment", "Free test ETH"),
    ("🔍", "Etherscan", "Explore live transactions & verify contracts", "sepolia.etherscan.io"),
    ("📊", "Blockchain Visual Demo", "Interactive block chaining visualization", "andersbrownworth.com"),
    ("🔧", "Web3.py / Brownie", "Python libraries for Ethereum interaction", "Open Source"),
]

for i, (icon, name, desc, type_info) in enumerate(tools):
    col = i % 2
    row = i // 2
    x = Inches(0.8) + Inches(col * 6.2)
    y = Inches(1.4) + Inches(row * 1.35)

    card = add_rounded_rect(slide, x, y, Inches(5.8), Inches(1.15), BG_CARD)

    add_text_box(slide, x + Inches(0.2), y + Inches(0.1), Inches(0.5), Inches(0.4),
                 icon, font_size=22, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, x + Inches(0.8), y + Inches(0.05), Inches(2.5), Inches(0.35),
                 name, font_size=16, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, x + Inches(3.5), y + Inches(0.08), Inches(2), Inches(0.3),
                 type_info, font_size=11, color=ACCENT_PURPLE, alignment=PP_ALIGN.RIGHT)
    add_text_box(slide, x + Inches(0.8), y + Inches(0.5), Inches(4.5), Inches(0.5),
                 desc, font_size=12, color=LIGHT_GRAY)

# Demo flow
flow = add_rounded_rect(slide, Inches(1.5), Inches(6.9), Inches(10), Inches(0.4), RGBColor(0x1A, 0x25, 0x3A))
add_text_box(slide, Inches(1.7), Inches(6.92), Inches(9.5), Inches(0.35),
             "Demo Flow:  Visual Demo  →  Python Hashing  →  Build Blockchain  →  Deploy on Sepolia  →  Verify on Etherscan",
             font_size=12, color=ACCENT_CYAN, alignment=PP_ALIGN.CENTER)

add_slide_number(slide, 13)


# ─── SLIDE 14: Thank You / Q&A ───
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

# Background image
if os.path.exists(IMAGES["chain"]):
    pic = slide.shapes.add_picture(IMAGES["chain"], Inches(0), Inches(0), Inches(13.333), Inches(7.5))

# Dark overlay
overlay = add_shape(slide, Inches(0), Inches(0), SLIDE_W, SLIDE_H, BG_DARK)

add_text_box(slide, Inches(0), Inches(2.0), Inches(13.333), Inches(0.6),
             "Thank You!", font_size=52, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)

add_accent_line(slide, Inches(5.5), Inches(3.0), Inches(2.5), ACCENT_CYAN)

add_text_box(slide, Inches(0), Inches(3.3), Inches(13.333), Inches(0.5),
             "Questions & Discussion", font_size=28, color=ACCENT_CYAN, alignment=PP_ALIGN.CENTER)

add_text_box(slide, Inches(0), Inches(4.3), Inches(13.333), Inches(0.4),
             "Siddharth Koul", font_size=22, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)

# Key resources
res_card = add_rounded_rect(slide, Inches(3.5), Inches(5.2), Inches(6.333), Inches(1.8), BG_CARD)
add_text_box(slide, Inches(3.7), Inches(5.3), Inches(5.9), Inches(0.3),
             "📚  Resources to Explore", font_size=15, color=ACCENT_CYAN, bold=True, alignment=PP_ALIGN.CENTER)
add_text_box(slide, Inches(3.7), Inches(5.7), Inches(5.9), Inches(1.2),
             "Bitcoin Whitepaper — bitcoin.org/bitcoin.pdf\n"
             "Ethereum Whitepaper — ethereum.org/whitepaper\n"
             "CryptoZombies — cryptozombies.io\n"
             "Blockchain Visual Demo — andersbrownworth.com/blockchain",
             font_size=12, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)


# ═══════════════════════════════════════════════════
# SAVE
# ═══════════════════════════════════════════════════
prs.save(OUTPUT_PATH)
print(f"✅ Presentation saved to: {OUTPUT_PATH}")
print(f"   Total slides: {len(prs.slides)}")
