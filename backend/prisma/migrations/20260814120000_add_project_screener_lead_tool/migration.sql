-- Voluntary carbon market project screening (/project-screener) captures leads
-- through the same POST /api/leads contract as the three IntelloCalc tools, so
-- it needs its own LeadTool value to be distinguishable in the leads table
-- rather than being folded into one of theirs.
--
-- Additive only: adding an enum value leaves every existing lead_captures row
-- untouched, and nothing reads LeadTool exhaustively in SQL.
ALTER TYPE "LeadTool" ADD VALUE 'PROJECT_SCREENER';
