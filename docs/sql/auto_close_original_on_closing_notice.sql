-- 「募集終了/募集停止」通知メールがprojectsに新規行として登録された際、
-- タイトル中の【NNN】(案件番号)が一致する募集中(isClosed=false)の元案件を
-- 自動でisClosed=trueにするトリガー。
--
-- 背景: Power Automateはメールのメッセージ IDをprojects_idとして採番するため、
-- 「募集終了のご案内」等の通知メール自体が新規案件として登録され、
-- 本来更新すべき元の案件行はisClosed=falseのまま残ってしまう事象が確認された。
-- (2026-07-23時点で31件中5件を手動修正済み。残りは案件番号が本文になかったり、
--  候補が複数あったりで自動判定できないため未対応)
--
-- 動作: 案件番号が一致する募集中の案件が「ちょうど1件」のときだけ自動更新する。
-- 0件または複数件ヒットする場合は何もしない(誤って別案件を閉じるのを避けるため)。
-- 通知メール自体の行(重複行)は削除しない。

create or replace function public.auto_close_original_project()
returns trigger
language plpgsql
as $$
declare
  v_num text;
  v_match_count int;
  v_original_id bigint;
begin
  if new."isClosed" is distinct from true then
    return new;
  end if;

  -- タイトルから【NNN】形式の案件番号を抽出
  v_num := substring(new.title from '【(\d+)】');
  if v_num is null then
    return new;
  end if;

  select count(*), min(id) into v_match_count, v_original_id
  from public.projects
  where "isClosed" = false
    and title ilike '%【' || v_num || '】%'
    and id <> new.id;

  if v_match_count = 1 then
    update public.projects
    set "isClosed" = true
    where id = v_original_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_close_original_project on public.projects;

create trigger trg_auto_close_original_project
after insert on public.projects
for each row
execute function public.auto_close_original_project();
