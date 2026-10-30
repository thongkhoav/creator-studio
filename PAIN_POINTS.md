# Content Creator Studio — Pain Points

Tài liệu này ghi lại các vấn đề lớn khi content creator phát triển kênh, quản lý ý tưởng và đưa nội dung từ ý tưởng đến publish. Đây là backlog sản phẩm, không phải danh sách tính năng đã hoàn thành.

## Pain point chính

### 1. Ý tưởng bị phân tán và khó tìm lại

Creator thường lưu ý tưởng trong Google Sheets, ghi chú, tin nhắn hoặc bookmark. Khi cần sản xuất một chủ đề, họ mất thời gian tìm lại hook, reference, audio và bối cảnh liên quan.

**Cơ hội sản phẩm:** một kho ý tưởng có tìm kiếm, filter, tag/concept, priority, platform và link reference.

### 2. Từ idea đến publish bị đứt đoạn

Một ý tưởng có thể tồn tại trong sheet nhưng không có owner, trạng thái, deadline, checklist hoặc link media. Team khó biết nội dung đang ở bước nào và vì sao bị tồn đọng.

**Cơ hội sản phẩm:** pipeline rõ ràng, owner, trạng thái, lịch đăng, checklist và liên kết giữa idea, variant, media.

### 3. Một nội dung phải biến đổi cho nhiều nền tảng

TikTok, Instagram Reels, YouTube Shorts, Facebook Reels, LinkedIn và X có yêu cầu khác nhau về hook, caption, thời lượng, safe zone và CTA. Creator dễ copy cùng một phiên bản cho mọi kênh rồi phải sửa thủ công.

**Cơ hội sản phẩm:** platform preset và content variant riêng cho từng nền tảng, có AI đề xuất adaptation.

### 4. Khó duy trì lịch đăng ổn định

Creator không nhìn được lịch tổng thể, dễ trùng ngày, bỏ sót deadline hoặc đăng quá dồn vào một nền tảng.

**Cơ hội sản phẩm:** calendar theo tuần/tháng, trạng thái lịch, người phụ trách, link published và cảnh báo nội dung chưa sẵn sàng.

### 5. Quản lý tài nguyên media rời rạc

Video, thumbnail, project file, audio và link đã publish thường nằm ở nhiều nơi. Việc tìm đúng bản cuối hoặc kiểm tra link trước khi đăng tốn thời gian.

**Cơ hội sản phẩm:** media asset dạng link, phân loại theo kind, gắn với idea/variant và kiểm tra URL hợp lệ. Giai đoạn đầu không cần lưu file trực tiếp.

### 6. Thiếu quy trình kiểm tra trước khi publish

Các bước như kiểm tra caption, thumbnail, subtitle, hashtag, quyền sử dụng audio, link bio và tracking thường phụ thuộc vào trí nhớ cá nhân.

**Cơ hội sản phẩm:** checklist theo variant/platform, người hoàn thành và thời điểm hoàn thành.

### 7. Brainstorm AI chưa gắn với dữ liệu thực tế

AI có thể tạo ý tưởng chung chung nếu không biết audience, format đã thử, platform mục tiêu, content backlog và reference của team.

**Cơ hội sản phẩm:** brainstorm theo workspace, lưu lịch sử kết quả, cho phép biến kết quả thành idea và tạo adaptation theo từng platform.

### 8. Team nhiều người dễ ghi đè hoặc thiếu quyền hạn

Khi nhiều người cùng làm, khó biết ai được sửa, ai phụ trách và ai có quyền mời thành viên hoặc thay đổi preset.

**Cơ hội sản phẩm:** workspace, role owner/admin/editor/viewer, audit log và quyền theo thao tác.

### 9. Dữ liệu cũ khó chuyển an toàn khỏi Google Sheets

Import trực tiếp có thể tạo bản ghi trùng, sai ngày, sai liên kết audio hoặc làm lộ dữ liệu giữa các workspace.

**Cơ hội sản phẩm:** import JSON có preview/validation, migration có timestamp, backfill có preview count và transaction atomic.

### 10. Không đo được nội dung nào thực sự hiệu quả

Creator biết video đã đăng nhưng không có hệ thống liên kết format, hook, platform với kết quả như views, watch time, saves, shares hoặc conversion.

**Cơ hội sản phẩm:** performance snapshot thủ công trước, sau đó mới tích hợp API nền tảng nếu cần.

## Ưu tiên đề xuất

### P0 — cần giải quyết để workflow dùng được

- Tìm kiếm và filter idea theo trạng thái, platform, priority và ngày.
- Liên kết idea → content variant → schedule → media link.
- Calendar CRUD và publishing checklist.
- Workspace scoping, role cơ bản và import/backfill an toàn.

### P1 — giúp team làm nhanh và nhất quán hơn

- Platform preset editor.
- AI brainstorm theo workspace và lưu kết quả thành idea.
- Invite/manage members và activity history.
- Template checklist theo platform hoặc format.

### P2 — giúp phát triển kênh dựa trên dữ liệu

- Performance tracking theo platform.
- Phân tích hook/format có hiệu quả.
- Gợi ý lịch đăng dựa trên lịch sử.
- Tích hợp API publish hoặc analytics của từng nền tảng.

## Nguyên tắc sản phẩm

- Workspace là ranh giới dữ liệu và quyền truy cập.
- AI hỗ trợ quyết định; creator vẫn duyệt nội dung trước khi dùng.
- Media giai đoạn đầu lưu bằng link ngoài, không upload file vào app.
- Mọi thao tác migration dữ liệu cũ phải có preview và quyền owner.
- Không lưu secret key ở frontend hoặc trong file import.
