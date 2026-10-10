from __future__ import annotations

import argparse
import mimetypes
import os
from pathlib import Path

import requests


def normalize_subject(value: str) -> str:
    digits = ''.join(ch for ch in str(value) if ch.isdigit())
    if not digits:
        raise ValueError('被験者番号に数字がありません')
    number = int(digits)
    if number < 0 or number > 999:
        raise ValueError('被験者番号は 001〜999 を想定しています')
    return f'OC2026_{number:03d}'


def upload_result(image_path: str | Path, subject_number: str) -> str:
    image_path = Path(image_path)
    if not image_path.exists():
        raise FileNotFoundError(image_path)

    supabase_url = os.environ['SUPABASE_URL'].rstrip('/')
    service_role_key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    bucket = os.environ.get('SUPABASE_BUCKET', 'oc2026-results')

    subject_id = normalize_subject(subject_number)
    object_name = f'{subject_id}_result.png'
    endpoint = f'{supabase_url}/storage/v1/object/{bucket}/{object_name}'

    content_type = mimetypes.guess_type(image_path.name)[0] or 'image/png'
    headers = {
        'Authorization': f'Bearer {service_role_key}',
        'apikey': service_role_key,
        'Content-Type': content_type,
        'x-upsert': 'true',
    }

    with image_path.open('rb') as f:
        response = requests.post(endpoint, headers=headers, data=f, timeout=60)

    if response.status_code not in (200, 201):
        raise RuntimeError(f'アップロード失敗: {response.status_code} {response.text}')

    public_url = f'{supabase_url}/storage/v1/object/public/{bucket}/{object_name}'
    print(f'アップロード完了: {subject_id}')
    print(public_url)
    return public_url


def main() -> None:
    parser = argparse.ArgumentParser(description='OC2026 採点結果画像をSupabase Storageへアップロード')
    parser.add_argument('image', help='採点結果PNGのパス')
    parser.add_argument('subject_number', help='例: 1 / 001 / OC2026_001')
    args = parser.parse_args()
    upload_result(args.image, args.subject_number)


if __name__ == '__main__':
    main()
