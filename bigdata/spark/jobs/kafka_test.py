from pyspark.sql import SparkSession

spark = SparkSession.builder \
    .appName("KafkaTest") \
    .getOrCreate()

df = spark \
    .readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:9092") \
    .option("subscribe", "test-topic") \
    .option("startingOffsets", "earliest") \
    .load()

df = df.selectExpr("CAST(value AS STRING)")

query = df \
    .writeStream \
    .format("console") \
    .outputMode("append") \
    .option("checkpointLocation", "/tmp/spark-checkpoint") \
    .start()

query.awaitTermination()