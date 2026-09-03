app.get('/api/hotels/:hotelId', (req, res) => {
  const hotel = store.getHotelById(req.params.hotelId);
  if (!hotel) {
    return res.status(404).json({ error: 'Hotel not found' });
  }
  res.json({ success: true, hotel });
});
