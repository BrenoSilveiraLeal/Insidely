-- Not every profession has career levels (júnior, pleno, sênior…): "Não se aplica".
alter type public."Seniority" add value if not exists 'NOT_APPLICABLE';
