-- Amplía el límite por archivo del bucket de imágenes de propiedades
-- para admitir fotos pesadas (cámara / WhatsApp) tras el recorte 16:9.

update storage.buckets
set file_size_limit = 10485760
where id = 'property-images';
