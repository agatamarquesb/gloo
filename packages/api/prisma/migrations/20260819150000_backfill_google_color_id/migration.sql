-- Fill in googleColorId for the rows imported before that column existed.
--
-- Without this they carry a colour and no record of where it came from, and the
-- next sync that mentions one reads "Google says 4, we recorded nothing" as a
-- change and adopts Google's answer — overwriting a colour the user had since
-- chosen here. Exactly the revert googleColorId is there to prevent.
--
-- The mapping is Google's own eleven event colours, which is where every one of
-- these hex values came from in the first place, so this is reading back what
-- the importer wrote rather than guessing. See GOOGLE_EVENT_COLORS.
UPDATE "calendar_events" SET "googleColorId" = CASE lower("color")
  WHEN '#7986cb' THEN '1'
  WHEN '#33b679' THEN '2'
  WHEN '#8e24aa' THEN '3'
  WHEN '#e67c73' THEN '4'
  WHEN '#f6bf26' THEN '5'
  WHEN '#f4511e' THEN '6'
  WHEN '#039be5' THEN '7'
  WHEN '#616161' THEN '8'
  WHEN '#3f51b5' THEN '9'
  WHEN '#0b8043' THEN '10'
  WHEN '#d50000' THEN '11'
END
WHERE "googleColorId" IS NULL
  AND "googleEventId" IS NOT NULL
  AND lower("color") IN (
    '#7986cb','#33b679','#8e24aa','#e67c73','#f6bf26','#f4511e',
    '#039be5','#616161','#3f51b5','#0b8043','#d50000'
  );
